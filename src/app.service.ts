import { Injectable, Logger, HttpService } from '@nestjs/common';
import * as request from 'request';
import * as fs from 'fs';

import * as config from 'config';
import * as path from 'path';
import * as moment from 'moment-timezone';
import { ApiCallService } from './api-call.service';
import { StockFeaturesService } from './stock-features.service';
import { KiteService } from './kite.service';
import { ZerodhaService } from './zerodha.service';

@Injectable()
export class AppService {
  async getPriceAction(symbol: string) {
    const instrumentToken = await this.kiteService.getInsruments(symbol);
    const data = await this.zerodhaService.getHistorical(instrumentToken, "5minute", moment()
      .format('YYYY-MM-DD') + '+09:15:00')

    const highestHigh = Math.max(...data.map(x => x[2]));
    const lowestLow = Math.min(...data.map(x => x[3]));

    const highLowLength = Math.abs(highestHigh - lowestLow);

    const highCandelIndex = data.indexOf(data.find(x => x[2] === highestHigh));
    const lowCandelIndex = data.indexOf(data.find(x => x[3] === lowestLow));
    const totalCandels = Math.abs(highCandelIndex - lowCandelIndex);
    const per60 = Math.round(totalCandels * 50 / 100)

    let dataFirst60, dataLast60;
    if (highCandelIndex < lowCandelIndex) {
      dataFirst60 = data.slice(highCandelIndex, per60);
      dataLast60 = data.slice(per60, lowCandelIndex);
    } else {
      dataFirst60 = data.slice(lowCandelIndex, per60);
      dataLast60 = data.slice(per60, highCandelIndex);
    }

    const latestCandel = data[data.length - 1];

    const firstHigh = Math.max(...dataFirst60.map(x => x[2]));
    const firstLow = Math.min(...dataFirst60.map(x => x[3]));

    let lastHigh = Math.max(...dataLast60.map(x => x[2]));

    let lastLow = Math.min(...dataLast60.map(x => x[3]));

    if (highCandelIndex < lowCandelIndex) {
      const firstLowCandelIndex = data.indexOf(data.find(x => x[3] === firstLow));
      const dataLast601 = data.slice(firstLowCandelIndex, lowCandelIndex)
      lastHigh = Math.max(...dataLast601.map(x => x[2]));
    } else {
      const firstHighCandelIndex = data.indexOf(data.find(x => x[2] === firstHigh));
      const dataLast601 = data.slice(firstHighCandelIndex, highCandelIndex)
      lastLow = Math.min(...dataLast601.map(x => x[3]));
    }



    let trend = 'SIDEBASE';
    if (highestHigh > lastHigh && lowestLow < firstLow) {
      trend = 'DOWN';
    } else if (highestHigh > firstHigh && lowestLow < lastLow) {
      trend = 'UP';
    }

    let valid = false;
    let high = firstHigh, low = firstLow;
    const perGap60 = (highLowLength * 0.6)
    if (trend == "DOWN") {
      valid = latestCandel[4] > lowestLow && latestCandel[4] < (lowestLow + perGap60)
      low = firstLow;
      high = lastHigh;
    }
    else if (trend == "UP") {
      valid = latestCandel[4] < highestHigh && latestCandel[4] > (highestHigh - perGap60)
      high = firstHigh;
      low = lastLow;
    }


    return { highestHigh, lowestLow, high, low, highCandelIndex, lowCandelIndex, totalCandels, per60, trend, valid, data }

  }
  private logger = new Logger('AppService');

  budgetPerStock = 30000;

  stockMargin: any;
  currentData: any[];

  constructor(
    private apiService: ApiCallService,
    private kiteService: KiteService,
    private zerodhaService: ZerodhaService,
    private stockFeaturesService: StockFeaturesService,
  ) {
    kiteService.getMargins().then(x => {
      this.stockMargin = x;
    });
  }

  // async getLiveInformation(stocks: string) {
  //   const result = await this.getLiveDataOfStock(stocks);
  //   if (!result) {
  //     return 'Unable to get historical data.';
  //   }
  //   const liveData: any[] = result.find(y => y.symbol === stocks).data;
  //   const newTrend = liveData.find(y => y.superTrend !== '').superTrend;

  //   const { open, high, low, close, per, ptsC } = liveData[0];

  //   const response: any = { symbol: stocks, open, high, low, close, per, ptsC };
  //   response.currentTrend = newTrend;

  //   let oppositeTrend = 'BUY';

  //   if (response.currentTrend === 'BUY') {
  //     oppositeTrend = 'SELL';
  //   }

  //   const indexOfOppositeTrend = liveData.indexOf(
  //     liveData.find(y => y.superTrend === oppositeTrend),
  //   );

  //   const currentTrendData = liveData.slice(0, indexOfOppositeTrend);

  //   response.trendCount = currentTrendData.filter(
  //     y => y.superTrend === response.currentTrend,
  //   ).length;

  //   // this.appGateway.wss.emit('new Data', response);

  //   return response;
  // }

  async getDayData(instrumentToken) {
    const data = await this.zerodhaService.getHistorical(instrumentToken, 'day');
    for (const iterator of data) {
      iterator[5] = Math.abs(iterator[1] - iterator[4])
    }
    let total = 0;
    for (const iterator of data) {
      total += iterator[5];
    }


    const avg = total / data.length;
    const lastCandelHeight = data[data.length - 1][5];
    const goodOne = lastCandelHeight < (avg * 60 / 100)
    return { avg, lastCandelHeight, goodOne, d: (avg * 60 / 100), data };
  }


  async getLatest5MinutesData(instrumentToken) {
    const dataAll = await this.zerodhaService.getHistorical(instrumentToken);

    const data = dataAll[dataAll.length - 2];
    let candelType = "GREEN"
    if (data[1] > data[4]) {
      candelType = "RED"

    }

    return { candelType, data };
  }


  async getLiveStockInformation(stocks: any, withAllData: any) {
    try {
      if (withAllData) {
        withAllData = withAllData === 'true';
      }

      stocks = stocks.split(',');

      const result = await this.getLiveDataOfStock(stocks);
      if (!result) {
        return 'Unable to get historical data.';
      }

      if (withAllData && !this.currentData) {
        await this.getIntradayStocks();
      }
      // stocks = stocks.join(',');
      // stocks = stocks.replace('%26', '&');
      // stocks = stocks.split(',');
      if (withAllData) {
        for (let x of this.currentData) {
          if (stocks.includes(x.symbol)) {
            const liveData: any[] = result.find(y => y.symbol === x.symbol)
              .data;
            x = this.assignResult(x, liveData);
          }
        }

        return this.currentData;
      } else {
        const data = [];
        const quotes = await this.kiteService.getQuote(stocks);
        for (const stock of stocks) {
          const quote = quotes[`NSE:${stock}`];
          const per = ((quote.net_change * 100) / quote.ohlc.open).toFixed(2);
          let item = {
            symbol: stock,
            ltP: quote.last_price,
            per,
            ptsC: quote.net_change,
          };
          const liveData: any[] = result.find(y => y.symbol === item.symbol)
            .data;
          item = this.assignResult(item, liveData);
          data.push(item);
        }
        return data;
      }
    } catch (ex) {
      throw new Error(ex);
    }
  }
  assignResult(x: any, liveData: any): any {
    const newTrend = liveData.find(y => y.superTrend !== '').superTrend;

    x.ma = liveData[0].ma.toFixed(2);
    x.ema = liveData[0].ema.toFixed(2);
    x.rsi = liveData[0].rsi.toFixed(2);

    if (liveData[0].vwap) {
      x.vwap = liveData[0].vwap.toFixed(2);
      x.vwapIsTooFar = liveData[0].vwapIsTooFar;
      x.vwapIsOnAbove = false;
      if (x.vwap > x.ltP) {
        x.vwapIsOnAbove = true;
      }
      x.perfectVwap = false;
      if (x.vwap < x.ltP && liveData[0].perfectVwapBuy) {
        x.perfectVwap = true;
      } else if (x.vwap > x.ltP && liveData[0].perfectVwapSell) {
        x.perfectVwap = true;
      }
    }
    x.currentTrend = newTrend;

    let oppositeTrend = 'BUY';

    if (x.currentTrend === 'BUY') {
      oppositeTrend = 'SELL';
    }

    const indexOfOppositeTrend = liveData.indexOf(
      liveData.find(y => y.superTrend === oppositeTrend),
    );

    const currentTrendData = liveData.slice(0, indexOfOppositeTrend);

    x.trendCount = currentTrendData.filter(
      y => y.superTrend === x.currentTrend,
    ).length;
    return x;
  }
  async getLiveDataOfStock(stocks: any) {
    // stocks = stocks.replace('&', '%26');
    const result = [];

    for (const x of stocks) {
      try {
        let data = [];
        const intervalInMinutes = 15;

        const instrumentToken = await this.kiteService.getInsruments(x);

        data = await this.kiteService.getHistorical(instrumentToken);
        if (!data) {
          return null;
        }
        data = data.sort((a: any, b: any) => {
          const b0: any = new Date(b[0]);
          const a0: any = new Date(a[0]);
          return b0 - a0;
        });
        // const rawdata: any = fs.readFileSync(
        //   path.join(__dirname, 'livedata.json'),
        // );
        // data = JSON.parse(rawdata);
        // data = data.filter(
        //   d => +d.open !== 0 && +d.high !== 0 && +d.low !== 0,
        // );

        if (!x.startsWith('NIFTY')) {
          data = data.filter((d: any) => d[5] !== 0);
        }

        data = this.stockFeaturesService.getRecalculatedData(data);
        // const symbol = x.replace('%26', '&');

        result.push({
          symbol: x,
          data,
        });
      } catch (ex) {
        throw new Error(ex);
      }
    }
    return result;
  }

  async getEquityInformation() {
    const liveDataJ = await this.apiService.getLiveJuniorEquityStock();
    const liveData = await this.apiService.getLiveEquityStock();
    liveData.data = [...liveData.data, ...liveDataJ.data];

    // const equityDataRaw: any = fs.readFileSync(
    //   path.join(__dirname, 'equity-data.json'),
    // );
    // const liveData = JSON.parse(equityDataRaw);

    const indicesLiveData = await this.apiService.getIndices();
    const nifty50 = indicesLiveData.data.find(x => x.name === 'NIFTY 50');

    const { change, pChange } = nifty50;
    const nifty = { ptsC: change, per: pChange };
    if (!this.currentData) {
      await this.getIntradayStocks();
    }
    if (this.currentData && this.currentData.length > 0) {
      for (const x of this.currentData) {
        const live = liveData.data.find(a => a.symbol === x.symbol);

        const { open, per, ptsC, ltP } = live;

        x.per = per;
        x.ptsC = ptsC.replace(',', '');
        x.ltP = ltP.replace(',', '');
        x.open = open.replace(',', '');
      }

      this.currentData = this.currentData.sort((a, b) => b.per - a.per);
      for (const x of this.currentData) {
        const index = this.currentData.indexOf(x);
        x.rank = index + 1;
      }
      return { nifty, stocks: this.currentData };
    }
    return 'Data not available';
  }
  async getVolumeStocks() {
    if (!this.currentData) {
      await this.getIntradayStocks();
    }
    let volumeStocks = await this.apiService.getVolumeStocks();
    volumeStocks = volumeStocks.filter(x =>
      this.currentData.map(y => y.symbol).includes(x.nsecode),
    );
    const final = [];
    for (const stock of volumeStocks) {
      const instrumentToken = await this.kiteService.getInsruments(stock.nsecode);

      const dayData = await this.getDayData(instrumentToken);

      const priceAction = await this.getPriceAction(stock.nsecode);
      if (dayData.goodOne && priceAction.valid) {
        final.push(stock);
      }
    }
    return final;
  }

  async getIntradayStocks(lastTradeDate?: string) {
    try {
      if (this.currentData) {
        return this.currentData;
      }
      let latestTradeDate = lastTradeDate;
      latestTradeDate = config.get('latestTradeDate');
      if (!latestTradeDate) {
        const indies: any = await this.apiService.getIndices();

        latestTradeDate = moment(indies.time).format('DDMMYYYY');
      }

      // const niftyStocks = await this.apiService.getNifty50Stocks();
      const niftyStocks = await this.apiService.getNifty100Stocks();

      const dailyVolatilited = await this.apiService.getDailyVolatilitedStocks(
        latestTradeDate,
      );

      const niftyVolatilited = dailyVolatilited.filter(x =>
        niftyStocks.map(y => y.Symbol).includes(x.Symbol),
      );

      let final = [];
      const liveDataJ = await this.apiService.getLiveJuniorEquityStock();

      const liveData = await this.apiService.getLiveEquityStock();

      liveData.data = [...liveData.data, ...liveDataJ.data];

      for (const x of niftyVolatilited) {
        x.daily =
          x['Current Day Underlying Daily Volatility (E) = Sqrt(0'][
          '94*D*D + 0'
          ]['06*C*C)'] * 100;

        const live = liveData.data.find(a => a.symbol === x.Symbol);
        if (live) {
          const { daily } = x;
          const { symbol, open, per, ptsC, ltP } = live;

          final.push({
            daily: +daily,
            symbol,
            open: +open.replace(',', ''),
            per: +per,
            ltP: +ltP.replace(',', ''),
            ptsC: +ptsC.replace(',', ''),
          });
        }
      }

      const sum = final
        .map(x => x.daily)
        .reduce((previous, current) => (current += previous));
      const avg = sum / final.length;

      final = final
        // .filter(x => x.daily > avg && Math.abs(x.per) > 1)
        .filter(x => x.daily > avg)

        .sort((x, y) => {
          return y.daily - x.daily && y.per - x.per;
        });

      for (const x of final) {
        const margin = this.stockMargin.find(y => y.symbol === x.symbol);
        if (margin) {
          x.margin = margin.margin;
        } else {
          x.margin = 'NA';
        }
        if (this.budgetPerStock / x.ltP < 10) {
          x.quantity = (this.budgetPerStock / x.ltP).toFixed();
        } else {
          x.quantity = Math.round(this.budgetPerStock / x.ltP / 10) * 10;
        }
      }

      this.currentData = final.filter(x => x.margin > 5);
      // this.currentData = final;
      return this.currentData;
    } catch (error) {
      throw error;
    }
  }
}

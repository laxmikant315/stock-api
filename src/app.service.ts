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
import { Expo } from 'expo-server-sdk';

import { jsonc } from 'jsonc';
import { of } from 'rxjs';
import e = require('express');
@Injectable()
export class AppService {
  data: any;
  instruments: any;

  async getProper(symbol: string) {
    // const instrumentToken = await this.kiteService.getInsruments(symbol);
    // const data = await this.zerodhaService.getHistorical(instrumentToken, "5minute", moment()
    //   .format('YYYY-MM-DD') + '+09:15:00');
    const data = this.data.concat();

    const candels = [];
    let firstCandel = data[0].concat();
    firstCandel = this.fillCandelInfo(firstCandel);

    candels.push(firstCandel);

    for (let i = 0; i < data.length; i++) {
      const candel = data[i];
      const dataBetween = data.slice(firstCandel.index, i + 1);
      if (dataBetween.length <= 2) {
        continue;
      }
      const lowest = this.getLowestCandel(dataBetween);

      if (candel[2] > (lowest[3] + ((candels[0][2] - lowest[3]) * 0.24))) {
        candels.push(lowest);
      }
      if (candels[1]) {
        candels[1] = this.fillCandelInfo(candels[1]);
        const dataBetween1 = data.slice(candels[1].index, i + 1);
        const highest = this.getHighestCandel(dataBetween1)
        if (candel[3] < (highest[2] - ((highest[2] - candels[1][3]) * 0.24))) {
          candels.push(highest);
        }
      }

    }

    return candels;


  }
  fillCandelInfo(candel: any): any {

    if (candel[4] > candel[1]) {
      candel.isGreen = true;
    } else {
      candel.isGreen = false;
    }
    candel.index = this.data.map(x => x[0]).indexOf(candel[0])

    return candel;
  }
  getHighestCandel(dataBetween: any) {
    let candel = dataBetween[0];
    for (const item of dataBetween) {
      if (item[2] > candel[2]) {
        candel = item;

      }
    }
    return candel
  }
  getLowestCandel(dataBetween: any) {
    let candel = dataBetween[0];
    for (const item of dataBetween) {
      if (item[3] < candel[3]) {
        candel = item

      }
    }
    return candel
  }

  expo = new Expo();

  tokens = [];
  pushToken(body: any): any {
    this.tokens.push(body.token.value);
  }





  async getPriceAction(instrumentToken: string,interval="5minute") {

    let from =""
    if(interval==="5minute"){
      from=moment()
      .format('YYYY-MM-DD') + '+09:15:00'}
      else if(interval==="day"){
        from=moment().add(-60,"days")
        .format('YYYY-MM-DD') + '+09:15:00'}
      
    const data = await this.zerodhaService.getHistorical(instrumentToken, interval, from)

 

    // const highestHigh = Math.max(...data.map(x => x[2]));

    const highestHigh = this.getHighestHigh(data);

    // const lowestLow = Math.min(...data.map(x => x[3]));
    const lowestLow = this.getLowestLow(data);

    const highLowLength = Math.abs(highestHigh.highest - lowestLow.lowest);

    // const highCandelIndex = data.indexOf(data.find(x => x[2] === highestHigh));

    // const lowCandelIndex = data.indexOf(data.find(x => x[3] === lowestLow));

    const totalCandels = Math.abs(highestHigh.index - lowestLow.index) + 1;
    const per60 = Math.round(totalCandels * 50 / 100)

    let dataFirst60, dataLast60;
    let goingUp = false;
    if (highestHigh.index < lowestLow.index) {
      dataFirst60 = data.slice(highestHigh.index, highestHigh.index + per60 + 1);
      dataLast60 = data.slice(lowestLow.index - per60, lowestLow.index + 1);
    } else {
      goingUp = true;
      dataFirst60 = data.slice(lowestLow.index, lowestLow.index + per60 + 1);
      dataLast60 = data.slice(highestHigh.index - per60, highestHigh.index + 1);
    }

    const latestCandel = data[data.length - 1];

    // const firstHigh = Math.max(...dataFirst60.map(x => x[2]));
    const firstHigh = this.getHighestHigh(dataFirst60, "FIRST", goingUp, goingUp ? lowestLow.index : highestHigh.index);
    // const firstLow = Math.min(...dataFirst60.map(x => x[3]));
    const firstLow = this.getLowestLow(dataFirst60, "FIRST", goingUp, goingUp ? lowestLow.index : highestHigh.index);

    // let lastHigh = Math.max(...dataLast60.map(x => x[2]));
    let lastHigh = this.getHighestHigh(dataLast60, "LAST", goingUp, goingUp ? highestHigh.index : lowestLow.index);
    // let lastLow = Math.min(...dataLast60.map(x => x[3]));
    let lastLow = this.getLowestLow(dataLast60, "LAST", goingUp, goingUp ? highestHigh.index : lowestLow.index);

    if (highestHigh.index < lowestLow.index) {
      // const firstLowCandelIndex = data.indexOf(data.find(x => x[3] === firstLow));
      const dataLast601 = data.slice(firstLow.index + 1, lowestLow.index)
      // lastHigh = Math.max(...dataLast601.map(x => x[2]));
      lastHigh = this.getHighestHigh(dataLast601, "MID", goingUp, goingUp ? firstLow.index + 1 : lowestLow.index);
    } else {
      // const firstHighCandelIndex = data.indexOf(data.find(x => x[2] === firstHigh));

      const dataLast601 = data.slice(firstHigh.index + 1, highestHigh.index)
      // lastLow = Math.min(...dataLast601.map(x => x[3]));
      lastLow = this.getLowestLow(dataLast601, "MID", goingUp, goingUp ? firstHigh.index + 1 : highestHigh.index);
    }



    let trend = 'SIDEBASE';
    if (highestHigh.highest > lastHigh.highest && lowestLow.lowest < firstLow.lowest) {
      trend = 'DOWN';
    } else if (highestHigh.highest > firstHigh.highest && lowestLow.lowest < lastLow.lowest) {
      trend = 'UP';
    }

    let valid = false;
    let high = firstHigh, low = firstLow;
    const perGap60 = (highLowLength * 0.6)
    if (trend == "DOWN") {
      valid = latestCandel[4] > lowestLow.lowest && latestCandel[4] < (lowestLow.lowest + perGap60)
      low = firstLow;
      high = lastHigh;
      if (data.length - 1 <= lowestLow.index + 3) {
        valid = false;
      }
    }
    else if (trend == "UP") {
      valid = latestCandel[4] < highestHigh.highest && latestCandel[4] > (highestHigh.highest - perGap60)
      high = firstHigh;
      low = lastLow;
      if (data.length - 1 <= highestHigh.index + 3) {
        valid = false;
      }
    }

   

    const firstHourData = data.filter((x,i)=>i<12);
  
    const fhdHigh = this.getHighestHigh(firstHourData).highest;
    const fhdLow = this.getLowestLow(firstHourData).lowest;
 
 
    if (
      (!high || !low) ||
      ( trend =='UP' && (highestHigh.highest<=fhdHigh && lowestLow.lowest <= fhdLow)) || 
      trend =='DOWN' && (highestHigh.highest>=fhdHigh && lowestLow.lowest >= fhdLow)
       ) {

      valid = false;
      trend = "SIDEBASE"
    }

    let lastCandelIsGreen=true;
    if(latestCandel[1]>latestCandel[4]){
      lastCandelIsGreen=false;
    }
    
    return { highestHigh, lowestLow, high, low, totalCandels, per60, trend, valid, firstHourData:{fhdHigh,fhdLow},lastCandelIsGreen }

  }
  getHighestHigh(data: any, type: any = "", goingUp: any = false, indexHigh: any = 0) {
    let highest, index = 0;
    if (data[0]) {
      highest = data[0][2];
    }

    for (const item of data) {

      if (item[2] > highest) {
        highest = item[2]
        index = data.indexOf(item);
      }
    }
    if (type === 'FIRST' && !goingUp) {
      index = indexHigh
    }
    else if (type === 'FIRST' && goingUp) {
      index = index + indexHigh
    }
    else if (type === 'LAST' && goingUp) {
      index = indexHigh
    }
    else if (type === 'LAST' && !goingUp) {
      index = indexHigh - (data.length + index)
    }
    else if (type === 'MID' && goingUp) {
      index = indexHigh
    }
    else if (type === 'MID' && !goingUp) {
      index = indexHigh - data.length + index
    }
    return { highest, index }
  }
  getLowestLow(data: any, type: any = "", goingUp: any = false, indexLow: any = 0) {

    let lowest, index = 0;
    if (data[0]) {
      lowest = data[0][3];
    }

    for (const item of data) {
      if (item[3] < lowest) {
        lowest = item[3]
        index = data.indexOf(item);
      }
    }
    if (type === 'FIRST' && goingUp) {
      index = index + indexLow
    } else if (type === 'FIRST' && !goingUp) {
      index = indexLow + index;
    } else if (type === 'LAST' && goingUp) {
      index = indexLow - index + 1
    } else if (type === 'LAST' && !goingUp) {
      index = indexLow
    }
    else if (type === 'MID' && goingUp) {
      index = indexLow + index;
    }
    else if (type === 'MID' && !goingUp) {
      index = indexLow - (data.length + index)
    }
    return { lowest, index }
  }
  private logger = new Logger('AppService');

  budgetPerStock = 30000;

  stockMargin: any;
  currentData: any[];
  lastNotification = '';
  constructor(
    private apiService: ApiCallService,
    private kiteService: KiteService,
    private http: HttpService,
    private zerodhaService: ZerodhaService,
    private stockFeaturesService: StockFeaturesService,

  ) {


    let rawdata: any = fs.readFileSync(
      path.join(__dirname, '/data.jsonc'),
      'utf8',
    );
    this.data = jsonc.parse(rawdata);



    kiteService.getMargins().then(x => {
      this.stockMargin = x;
    });

    kiteService.getInsruments().then(x => {
      this.instruments = x;
    });

    setInterval(async () => {
      let messages = [];
      for (let pushToken of this.tokens) {
        // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

        // Check that all your push tokens appear to be valid Expo push tokens
        if (!Expo.isExpoPushToken(pushToken)) {
          console.error(`Push token ${pushToken} is not a valid Expo push token`);
          continue;
        }

        // Construct a message (see https://docs.expo.io/versions/latest/guides/push-notifications)

        const dataVol = await this.getVolumeStocks();
        if (dataVol && dataVol.length > 0) {
          const stocks = dataVol.map((x: any) => x.nsecode).join(' & ');
          const body = `Volume is showing for stock ` + stocks;
          // if (this.lastNotification !== body) {
          this.lastNotification = body;

          messages.push({
            to: pushToken,
            sound: 'default',
            body,
            data: { stocks: dataVol }
          });
          // }


        }



      }



      let chunks = this.expo.chunkPushNotifications(messages);
      let tickets = [];
      (async () => {
        // Send the chunks to the Expo push notification service. There are
        // different strategies you could use. A simple one is to send one chunk at a
        // time, which nicely spreads the load out over time:
        for (let chunk of chunks) {
          try {
            let ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
            
            tickets.push(...ticketChunk);
            // NOTE: If a ticket contains an error code in ticket.details.error, you
            // must handle it appropriately. The error codes are listed in the Expo
            // documentation:
            // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
          } catch (error) {
            console.error(error);
          }
        }
      })();

      let receiptIds = [];
      for (let ticket of tickets) {
        // NOTE: Not all tickets have IDs; for example, tickets for notifications
        // that could not be enqueued will have error information and no receipt ID.
        if (ticket.id) {
          receiptIds.push(ticket.id);
        }
      }

      let receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      (async () => {
        // Like sending notifications, there are different strategies you could use
        // to retrieve batches of receipts from the Expo service.
        for (let chunk of receiptIdChunks) {
          try {
            let receipts: any = await this.expo.getPushNotificationReceiptsAsync(chunk);
       

            // The receipts specify whether Apple or Google successfully received the
            // notification and information about an error, if one occurred.
            for (let receipt of receipts) {
              if (receipt.status === 'ok') {
                continue;
              } else if (receipt.status === 'error') {
                console.error(`There was an error sending a notification: ${receipt.message}`);
                if (receipt.details && receipt.details.error) {
                  // The error codes are listed in the Expo documentation:
                  // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
                  // You must handle the errors appropriately.
                  console.error(`The error code is ${receipt.details.error}`);
                }
              }
            }
          } catch (error) {
            console.error(error);
          }
        }
      })();
    }, 20000)



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

  async getDayData(instrumentToken,interval="day") {
    let from =moment()
    .add(-1, 'months')
    .format('YYYY-MM-DD+HH:mm:ss');

    let finalInterval=interval;
    if(interval==="month"){
      finalInterval="day"
      from =moment()
    .add(-65, 'months')
    .format('YYYY-MM-DD+HH:mm:ss')
    }
    let data = await this.zerodhaService.getHistorical(instrumentToken, finalInterval,from);
   
    if(interval==='month'){

      const bag=[];
      for(let r of data){
        
        const monthYear =moment(r[0]).format('YYYY-MM')
        if(!bag.find(x=>x[0]===monthYear))
        {
          bag.push([monthYear]);
        }
      }
      for(let b of bag){
     
        const monthData = data.filter(x=> moment(x[0]).format('YYYY-MM') === b[0]);
        const firstCandel=monthData[0];
        const lastCandel=monthData[monthData.length-1];
        
        const maxData=monthData.map(x=>x[2]);
        const minData=monthData.map(x=>x[3])
        const volumnData=monthData.map(x=>x[5])

        b[1]=firstCandel[1];
        b[2]=Math.max(...maxData);
        b[3]=Math.min(...minData);
        b[4]=lastCandel[4];
        b[5]=volumnData.reduce((x,y)=>x+y)
      
    }
   
    data=bag;
    }

    for (const iterator of data) {
      iterator[5] = Math.abs(iterator[1] - iterator[4])
    }
    let total = 0;
    for (const iterator of data) {
      total += iterator[5];
    }


    const avg = +(total / data.length).toFixed(2);
    const lastCandelHeight = +(data[data.length - 1][5]).toFixed(2);
    const allowedRange = +(avg * 70 / 100).toFixed(2);
    const goodOne = lastCandelHeight < allowedRange
    return { avg, lastCandelHeight, goodOne, allowedRange, data };
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

    const liveData = await this.apiService.getLiveEquityStock();
    const liveDataJ = await this.apiService.getLiveJuniorEquityStock();
    liveData.data = [...liveData.data, ...liveDataJ.data];

    // const equityDataRaw: any = fs.readFileSync(
    //   path.join(__dirname, 'equity-data.json'),
    // );
    // const liveData = JSON.parse(equityDataRaw);

    // const indicesLiveData = await this.apiService.getIndices();
    // const nifty50 = indicesLiveData.data.find(x => x.name === 'NIFTY 50');

    const nifty50 = liveData.metadata;

    const { change, percChange } = nifty50;
    const nifty = { ptsC: change, per: percChange };
    if (!this.currentData) {
      await this.getIntradayStocks();
    }
    if (this.currentData && this.currentData.length > 0) {
      for (const x of this.currentData) {
        const live = liveData.data.find(a => a.symbol === x.symbol);

        const { open, pChange, change, lastPrice } = live;

        x.per = pChange;
        x.ptsC = change;
        x.ltP = lastPrice;
        x.open = open;
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
  async getVolumeStocksOnly() {
    return await this.apiService.getVolumeStocks();
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
    if (volumeStocks && volumeStocks.length > 0) {
      for (const stock of volumeStocks) {
        const instrumentToken = await this.kiteService.getInsruments(stock.nsecode);

        const dayData = await this.getDayData(instrumentToken);

        const priceAction = await this.getPriceAction(instrumentToken);
        if (dayData.goodOne && priceAction.valid) {
          final.push(stock);
        }
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
        niftyStocks.map(y => y.symbol).includes(x.Symbol),
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
          const { symbol, open, pChange, change, lastPrice } = live;

          final.push({
            daily: +daily,
            symbol,
            open: +open,
            per: +pChange,
            ltP: +lastPrice,
            ptsC: +change,
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
        const instrument = this.instruments.find(y => y.tradingsymbol.toUpperCase() === x.symbol.toUpperCase());
        if (margin) {
          x.margin = margin.margin;
        } else {
          x.margin = 'NA';
        }
        if (instrument) {
          x.instrument = instrument.instrument_token;
        } else {
          x.instrument = "NA";
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

import { Logger, Injectable } from '@nestjs/common';

import * as moment from 'moment-timezone';

@Injectable()
export class StockFeaturesService {
  private logger = new Logger('StockFeaturesService');

  getRecalculatedData(liveDataStatic: any[]): any {
    let recalculatedData = [];

    for (const x of liveDataStatic) {
      // x.timestamp = this.convertTime(x.timestamp);
      const index = liveDataStatic.indexOf(x);
      const item: any = {};

      item.timestamp = x[0];
      item.open = x[1];
      item.high = x[2];
      item.low = x[3];
      item.close = x[4];
      item.volume = x[5];
      item.ltP = item.close;
      item.avg = (item.high + item.low + item.close) / 3;
      item.vp = item.volume * item.avg;

      const next = liveDataStatic[index + 1];
      let close = 0;
      if (next) {
        close = next[4];
      }
      item.chmpc = item.high - close;
      item.clmpc = item.low - close;
      item.chmcl = item.high - item.low;
      item.candelHeight = Math.abs(item.close - item.open);

      item.tr = Math.max(item.chmpc, item.clmpc, item.chmcl);

      // this.logger.warn(index, next);
      recalculatedData.push(item);
    }

    recalculatedData = this.calculateSuperTrend(recalculatedData);

    // Moving Avarage

    recalculatedData = this.calculateMovingAvarage(recalculatedData);

    // RSI
    recalculatedData = this.calculateRSI(recalculatedData);
    // Calculating VWAP  START
    recalculatedData = this.calculateVwap(recalculatedData);

    // Calculating VWAP  END

    return recalculatedData;
  }
  calculateVwap(recalculatedData: any[]): any[] {
    const avgCandel =
      recalculatedData
        .map(x => x.candelHeight)
        .reduce((x: any, y: any) => x + y) / recalculatedData.length;

    const avgVolume =
      recalculatedData.map(x => x.volume).reduce((x: any, y: any) => x + y) /
      recalculatedData.length;

    const vwapCandelRangeHigh = avgCandel + avgCandel * 0.7;
    const vwapCandelRangeLow = avgCandel - avgCandel * 0.7;

    const latest0 = this.calculateVwapByCancel(
      recalculatedData,
      0,
      1,
      vwapCandelRangeHigh,
      vwapCandelRangeLow,
      avgVolume,
    );

    const latest1 = this.calculateVwapByCancel(
      recalculatedData,
      1,
      2,
      vwapCandelRangeHigh,
      vwapCandelRangeLow,
      avgVolume,
    );

    const latest2 = this.calculateVwapByCancel(
      recalculatedData,
      2,
      3,
      vwapCandelRangeHigh,
      vwapCandelRangeLow,
      avgVolume,
    );
    const latest3 = this.calculateVwapByCancel(
      recalculatedData,
      3,
      4,
      vwapCandelRangeHigh,
      vwapCandelRangeLow,
      avgVolume,
    );

    if (
      latest1.perfectVwapBuy ||
      latest1.perfectVwapSell ||
      latest2.perfectVwapBuy ||
      latest2.perfectVwapSell ||
      latest3.perfectVwapBuy ||
      latest3.perfectVwapSell
    ) {
      if (!(latest0.perfectVwapBuy || latest0.perfectVwapSell)) {
        if (latest1.perfectVwapBuy || latest1.perfectVwapSell) {
          latest0.perfectVwapBuy = latest1.perfectVwapBuy;
          latest0.perfectVwapSell = latest1.perfectVwapSell;
        } else if (latest2.perfectVwapBuy || latest2.perfectVwapSell) {
          latest0.perfectVwapBuy = latest2.perfectVwapBuy;
          latest0.perfectVwapSell = latest2.perfectVwapSell;
        } else if (latest3.perfectVwapBuy || latest3.perfectVwapSell) {
          latest0.perfectVwapBuy = latest3.perfectVwapBuy;
          latest0.perfectVwapSell = latest3.perfectVwapSell;
        }
      }
    }

    const distance = Math.abs(latest0.vwap - latest0.close);
    const validDistance: number = +avgCandel * 2;
    if (distance > validDistance) {
      latest0.perfectVwapBuy = false;
      latest0.perfectVwapSell = false;
      latest0.vwapIsTooFar = true;
    }

    if (latest0.perfectVwapBuy && latest0.close < latest0.vwap) {
      latest0.perfectVwapBuy = false;
    } else if (latest0.perfectVwapSell && latest0.close > latest0.vwap) {
      latest0.perfectVwapSell = false;
    }

    recalculatedData[0] = latest0;
    return recalculatedData;
  }

  calculateRSI(recalculatedData: any[]): any[] {
    for (const x of recalculatedData) {
      const index = recalculatedData.indexOf(x);
      const nextIndex = index + 1;

      const closes = recalculatedData
        .slice(nextIndex, nextIndex + 14)
        .map(y => y.close);
      const diffrenceGain = [];
      const diffrenceLoss = [];
      for (let i = 0; i < closes.length; i++) {
        const nextI = i + 1;

        const previous = closes[nextI];
        const latest = closes[i];
        if (latest > previous) {
          diffrenceGain.push(Math.abs(previous - latest));
        } else if (latest < previous) {
          {
            diffrenceLoss.push(Math.abs(previous - latest));
          }
        }
      }

      if (
        diffrenceGain &&
        diffrenceGain.length > 0 &&
        diffrenceLoss &&
        diffrenceLoss.length > 0
      ) {
        const lastAvgGain = diffrenceGain.reduce((a, b) => a + b) / 14;
        const lastAvgLoss = diffrenceLoss.reduce((a, b) => a + b) / 14;

        const smoothedRS =
          (lastAvgGain * 13 + 0 / 14) / (lastAvgLoss * 13 + 1 / 14);
        x.rsi = 100 - 100 / (1 + smoothedRS);
      }
    }

    return recalculatedData;
  }

  calculateMovingAvarage(recalculatedData: any[]) {
    for (const x of recalculatedData) {
      const index = recalculatedData.indexOf(x);
      const nextIndex = index + 1;

      x.ma =
        recalculatedData
          .slice(1, 10)
          .map(y => y.close)
          .reduce((a, b) => a + b) / 9;

      const next = recalculatedData[nextIndex];
      if (next) {
        x.ema = 0.3 * next.close + (1 - 0.3) * x.ma;
      }
    }
    return recalculatedData;
  }
  calculateSuperTrend(recalculatedData: any[]): any {
    for (const x of recalculatedData) {
      const index = recalculatedData.indexOf(x);
      const nextIndex = index + 1;
      const next = recalculatedData[nextIndex];
      let tr = 0;
      if (next) {
        tr = next.tr;
      }
      x.atr = ((tr || 0) * 13 + x.tr) / 14;

      // x.highSuperRaw = (x.high + x.low) / 2 + 3 * x.atr;
      // x.lowSuperRaw = (x.high + x.low) / 2 - 3 * x.atr;
      const avg = (x.high + x.low) / 2;
      const atr3 = 3 * x.atr;

      x.highSuperRaw = avg + atr3;
      x.lowSuperRaw = avg - atr3;

      // const nextValues = this.getNextValues(next, nextIndex);
    }

    for (const x of recalculatedData) {
      const index = recalculatedData.indexOf(x);
      const nextIndex = index + 1;
      const next = recalculatedData[nextIndex];
      if (next) {
        const result = this.getHighLowSuper(
          x,
          next,
          nextIndex,
          recalculatedData,
        );
        x.highSuper = result.x.highSuper;
        x.lowSuper = result.x.lowSuper;
      } else {
        x.highSuper = x.highSuperRaw;
        x.lowSuper = x.lowSuperRaw;
      }
    }

    for (const x of recalculatedData) {
      const index = recalculatedData.indexOf(x);
      const nextIndex = index + 1;
      const next = recalculatedData[nextIndex];
      if (next) {
        x.superTrend =
          next.lowSuper > x.close
            ? 'SELL'
            : next.highSuper < x.close
            ? 'BUY'
            : '';
      } else {
        x.superTrend = '';
      }
    }
    return recalculatedData;
  }

  calculateVwapByCancel(
    liveDataStatic: any,
    latestIndex: any,
    previousIndex: any,
    vwapCandelRangeHigh: number,
    vwapCandelRangeLow: number,
    avgVolume: number,
  ) {
    const latest = liveDataStatic[latestIndex];
    const previous = liveDataStatic[previousIndex];

    const xDate = this.getFormattedDate(new Date(latest.timestamp));

    const dateDiffLatest = moment().diff(
      moment(latest.timestamp).format('YYYYMMDD'),
      'days',
    );
    const dateDiffPrevious = moment().diff(
      moment(previous.timestamp).format('YYYYMMDD'),
      'days',
    );

    if (dateDiffLatest !== 0 || dateDiffPrevious !== 0) {
      return latest;
    }

    const olderData = liveDataStatic
      .slice(0, liveDataStatic.length)
      .filter(y => {
        const yDate = this.getFormattedDate(new Date(y.timestamp));
        return xDate === yDate;
      });

    latest.totalVp = 0;
    latest.totalVol = 0;

    for (const y of olderData) {
      latest.totalVp += +y.vp;
      latest.totalVol += +y.volume;
    }

    latest.vwap = latest.totalVp / latest.totalVol;

    const candelSizeLatest = Math.abs(latest.close - latest.open);
    const candelSizePrevious = Math.abs(previous.close - previous.open);

    if (
      !(
        candelSizeLatest >= vwapCandelRangeLow &&
        candelSizeLatest <= vwapCandelRangeHigh &&
        candelSizePrevious >= vwapCandelRangeLow &&
        candelSizePrevious <= vwapCandelRangeHigh
      )
    ) {
      return latest;
    }

    if (!(latest.volume > avgVolume || previous.volume > avgVolume)) {
      return latest;
    }

    if (latest.close > latest.vwap * 0.01 + latest.vwap) {
      return latest;
    }

    if (
      latest.close > latest.open &&
      previous.close > previous.open &&
      latest.close > latest.vwap &&
      latest.open > latest.vwap &&
      latest.close > previous.close &&
      latest.open + latest.open * 0.0004 >= previous.close
    ) {
      latest.perfectVwapBuy = true;
    }

    if (
      latest.close < latest.open &&
      previous.close < previous.open &&
      latest.close < latest.vwap &&
      latest.open < latest.vwap &&
      latest.close < previous.close &&
      latest.open <= previous.close
    ) {
      latest.perfectVwapSell = true;
    }

    const vwapCheck = this.crossCheckVwapCandels(liveDataStatic, latest);
    if (!vwapCheck) {
      latest.perfectVwapSell = false;
      latest.perfectVwapBuy = false;
    }
    return latest;
  }
  crossCheckVwapCandels(liveDataStatic: any, latest: any) {
    const second = liveDataStatic[1];
    const third = liveDataStatic[2];
    const fourth = liveDataStatic[3];
    const fifth = liveDataStatic[4];

    if (latest.perfectVwapBuy) {
      if (
        this.crossCheckVwapCandelsBuy(second, latest) ||
        this.crossCheckVwapCandelsBuy(third, latest) ||
        this.crossCheckVwapCandelsBuy(fourth, latest) ||
        this.crossCheckVwapCandelsBuy(fifth, latest)
      ) {
        return true;
      }
    } else if (latest.perfectVwapSell) {
      if (
        this.crossCheckVwapCandelsSell(second, latest) ||
        this.crossCheckVwapCandelsSell(third, latest) ||
        this.crossCheckVwapCandelsSell(fourth, latest) ||
        this.crossCheckVwapCandelsSell(fifth, latest)
      ) {
        return true;
      }
    }
    return false;
  }
  crossCheckVwapCandelsBuy(item: any, latest: any) {
    if (item.open <= latest.vwap || item.close <= latest.vwap) {
      return true;
    }
  }
  crossCheckVwapCandelsSell(item: any, latest: any) {
    if (item.open >= latest.vwap || item.close >= latest.vwap) {
      return true;
    }
  }
  getFormattedDate(date: Date) {
    return (
      date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear()
    );
  }

  getHighLowSuper(x, y, index, liveDataStatic) {
    let a = 0;

    if (!y.highSuper && index === liveDataStatic.length - 1) {
      y.highSuper = 0;
      y.lowSuper = 0;
    } else {
      const nextIndex = index + 1;
      y = this.getHighLowSuper(
        y,
        liveDataStatic[nextIndex],
        nextIndex,
        liveDataStatic,
      ).x;
    }

    if (y.highSuper < x.highSuperRaw) {
      a = y.highSuper;
    } else {
      a = x.highSuperRaw;
    }
    if (a > x.close) {
      x.highSuper = a;
    } else {
      x.highSuper = x.highSuperRaw;
    }

    if (y.lowSuper > x.lowSuperRaw) {
      a = y.lowSuper;
    } else {
      a = x.lowSuperRaw;
    }
    if (a < x.close) {
      x.lowSuper = a;
    } else {
      x.lowSuper = x.lowSuperRaw;
    }

    return { x, y };
  }
}

import { Controller, Get, Param, Optional } from '@nestjs/common';
import { AppService } from './app.service';
import { KiteService } from './kite.service';
import { ZerodhaService } from './zerodha.service';

import * as moment from 'moment-timezone';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly kiteService: KiteService,
    private readonly zerodhaService: ZerodhaService,
  ) { }

  // @Get()
  // getHello(): string {
  //   return this.appService.getHello();
  // }

  @Get('getIntradayStocks/:lastTradeDate')
  getIntradayStocks(@Param('lastTradeDate') lastTradeDate: string): any {
    return this.appService.getIntradayStocks(lastTradeDate);
  }

  @Get('getIntradayStocks')
  getIntradayStocks1(): any {
    return this.appService.getIntradayStocks();
  }
  @Get('getEquityInformation/1')
  getEquityInformation(): any {
    return this.appService.getEquityInformation();
  }

  @Get('getHistorical/:symbol')
  async getHistorical(@Param('symbol') symbol: string) {
    const instrumentToken = await this.kiteService.getInsruments(symbol);

    return this.appService.getDayData(instrumentToken)
  }

  @Get('GetPriceAction/:symbol')
  async GetPriceAction(@Param('symbol') symbol: string) {
    return this.appService.getPriceAction(symbol);
  }



  @Get('getLatest5MinutesData/:symbol')
  async getLatest5MinutesData(@Param('symbol') symbol: string) {
    const instrumentToken = await this.kiteService.getInsruments(symbol);

    return this.appService.getLatest5MinutesData(instrumentToken);
  }



  @Get('getLiveStockInformation/:stocks/:withAllData')
  getLiveStockInformation(
    @Param('stocks') stocks: string,
    @Param('withAllData') withAllData: boolean,
  ): any {
    return this.appService.getLiveStockInformation(stocks, withAllData);
  }

  @Get('getVolumeStocks')
  getVolumeStocks(): any {
    return this.appService.getVolumeStocks();
  }


  // @Get('getLiveInformation/:stocks')
  // getLiveInformation(@Param('stocks') stocks: string): any {
  //   return this.appService.getLiveInformation(stocks);
  // }

  @Get('getAccessToken/:requestToken')
  getAccessToken(@Param('requestToken') requestToken: string): any {
    return this.kiteService.getAccessToken(requestToken);
  }
}

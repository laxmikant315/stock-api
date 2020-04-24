import * as csv from 'csvtojson';
import { Injectable, HttpService, Logger } from '@nestjs/common';

import * as config from 'config';

@Injectable()
export class ApiCallService {
  private logger = new Logger('ApiCallService');

  constructor(private http: HttpService) { }
  chartintToken = config.get('chartintToken');
  chartintCookie = config.get('chartintCookie');

  keyIndex = 0;
  async getLiveEquityStock() {
    return await this.http
      // .get(
      //   'https://www.nseindia.com/live_market/dynaContent/live_watch/stock_watch/niftyStockWatch.json',
      // )
      .get(
        'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050',
      )
      .toPromise()
      .then(x => x.data);
  }

  async getLiveJuniorEquityStock() {
    return await this.http
      // .get(
      //   'https://www.nseindia.com/live_market/dynaContent/live_watch/stock_watch/juniorNiftyStockWatch.json',
      // )
      .get(
        'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20NEXT%2050',
      )
      .toPromise()
      .then(x => x.data);
  }

  async getIndices() {
    return await this.http
      .get('https://www.nseindia.com/homepage/Indices1.json')
      .toPromise()
      .then(x => x.data);
  }
  async getVolumeStocks(interval="5minute") {
    let scan_clause='%7B33619%7D+(+%5B+0+%5D+5+minute+volume+%3E+(+(+%5B+-1+%5D+5+minute+volume+%2B+%5B+-2+%5D+5+minute+volume+%2B+%5B+-3+%5D+5+minute+volume+)+%2F+3+)+*+2.5+)';
    if(interval==='day'){
      scan_clause='(+%7Bcash%7D+(+latest+volume+%3E+(+(+1+day+ago+volume+%2B+2+days+ago+volume+%2B+3+days+ago+volume+%2B+4+days+ago+volume+%2B+5+days+ago+volume+)+%2F+5+)+*+2+)+)+'
    }

    return await this.http
      .post(
        'https://chartink.com/screener/process',
        // tslint:disable-next-line:max-line-length
        `scan_clause=${scan_clause}`,
       
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-CSRF-TOKEN': this.chartintToken,
            // tslint:disable-next-line:object-literal-key-quotes

            Cookie: this.chartintCookie
          },
        },
      )
      .toPromise()
      .then(x => x.data.data);
  }

  // async getNifty50Stocks() {
  //   const obj = await this.http
  //     .get('https://www.nseindia.com/content/indices/ind_nifty50list.csv')
  //     .toPromise();

  //   const data = await csv().fromString(obj.data);
  //   return data;
  // }


  async getNifty100Stocks() {
    const obj = await this.http
      // .get('https://www.nseindia.com/content/indices/ind_nifty100list.csv')
      .get('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20100')
      .toPromise();

    // const data = await csv().fromString(obj.data);
    return obj.data.data;
  }
  async getDailyVolatilitedStocks(dateNow: string) {
    const obj = await this.http
      // .get(`https://www.nseindia.com/archives/nsccl/volt/CMVOLT_${dateNow}.CSV`)
      .get(`https://archives.nseindia.com/archives/nsccl/volt/CMVOLT_${dateNow}.CSV`)
      .toPromise();

    // const data = this.fetchData();
    const data = await csv().fromString(obj.data);
    return data;
  }
}

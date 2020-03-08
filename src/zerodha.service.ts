import { Injectable, Logger, HttpService } from '@nestjs/common';
import * as crypto from 'crypto';
import * as csv from 'csvtojson';
import * as moment from 'moment-timezone';
import * as qs from 'querystring';
import * as path from 'path';
import * as config from 'config';
import * as fs from 'fs';

@Injectable()
export class ZerodhaService {
  private logger = new Logger('ZerodhaService');
  zerodhaConfig = config.get('zerodha');
  constructor(private http: HttpService) { }

  zerodhaUrl = this.zerodhaConfig.url;

  accessToken = this.zerodhaConfig.accessToken;


  async getHistorical(
    instrumentToken: any,
    interval = '5minute',
    from = moment()
      .add(-1, 'months')
      .format('YYYY-MM-DD+HH:mm:ss'),
    to = moment().format('YYYY-MM-DD+HH:mm:ss'),
  ) {
    const url = `${this.zerodhaUrl}oms/instruments/historical/${instrumentToken}/${interval}?from=${from}&to=${to}`;
  
    return await this.http
      .get(url, {
        headers: {
          authorization: this.accessToken,
        },
      })
      .toPromise()
      .then(x => {
        return x.data.data.candles;
      })
      .catch(x => {
        return null;
      });
  }
}

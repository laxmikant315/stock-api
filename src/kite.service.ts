import { Injectable, Logger, HttpService } from '@nestjs/common';
import * as crypto from 'crypto';
import * as csv from 'csvtojson';
import * as moment from 'moment-timezone';
import * as qs from 'querystring';
import * as path from 'path';
import * as config from 'config';
import * as fs from 'fs';

@Injectable()
export class KiteService {
  private logger = new Logger('KiteService');
  kiteConfig = config.get('kite');
  constructor(private http: HttpService) { }

  kiteUrl = this.kiteConfig.url;
  apiKey = this.kiteConfig.apiKey;
  secret = this.kiteConfig.secret;
  accessToken = this.kiteConfig.accessToken;

  getCheckSum(str, algorithm?, encoding?) {
    return crypto
      .createHash(algorithm || 'md5')
      .update(str, 'utf8')
      .digest(encoding || 'hex');
  }

  async getAccessToken(requestToken: string) {
    const combinations = this.apiKey + requestToken + this.secret;

    const checksum = this.getCheckSum(combinations, 'sha256');
    const data = await this.getLogin(this.apiKey, requestToken, checksum).catch(
      error => {
        // this.logger.log(error);
        return error.message;
      },
    );

    return data;
  }

  async getLogin(apiKey, requestToken, checkSum) {
    return await this.http
      .post(
        `${this.kiteUrl}session/token`,

        qs.stringify({
          api_key: apiKey,
          request_token: requestToken,
          checksum: checkSum,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )
      .toPromise()
      .then(x => {
        const previousAccessToken = this.accessToken;
        this.accessToken = x.data.data.access_token;

        let rawdata: any = fs.readFileSync(
          path.join(__dirname, 'config/default.json'),
          'utf8',
        );
        this.logger.log(rawdata);
        rawdata = rawdata.replace(previousAccessToken, this.accessToken);
        fs.writeFileSync(path.join(__dirname, 'config/default.json'), rawdata);
        this.logger.log(rawdata);

        return {
          token: `token ${apiKey}:${this.accessToken}`,
          accessToken: this.accessToken,
          msg: 'Access Token generated successfully.',
        };
      })
      .catch(e => {
        return 'Failed to generate Access Token.';
      });
  }

  async getQuote(symbol) {
    let query = '';
    if (typeof symbol === 'string') {
      query = `i=NSE:${symbol}`;
    } else if (symbol.length > 0) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < symbol.length; i++) {
        let seperator = '';
        if (i > 0) {
          seperator = '&';
        }
        query += `${seperator}i=NSE:${symbol[i]}`;
      }
    }

    return await this.http
      .get(`${this.kiteUrl}quote?${query}`, {
        headers: {
          Authorization: `token ${this.apiKey}:${this.accessToken}`,
        },
      })
      .toPromise()
      .then(x => x.data.data);
  }

  async getInsruments(symbol?) {
    const data = await csv().fromFile(path.join(__dirname, 'instruments.csv'));
    if (symbol) {
      const stock = data.find(
        x =>
          x.tradingsymbol.toUpperCase() === symbol.toUpperCase() &&
          x.exchange === 'NSE',
      );
      if (stock) {
        return stock.instrument_token;
      }
    }
    return data;
  }
  async getMargins() {
    const data = await csv().fromFile(path.join(__dirname, 'margins.csv'));

    return data;
  }

  async getHistorical(
    instrumentToken: any,
    interval = '5minute',
    from = moment()
      .add(-1, 'months')
      .format('YYYY-MM-DD+HH:mm:ss'),
    to = moment().format('YYYY-MM-DD+HH:mm:ss'),
  ) {
    const url = `${this.kiteUrl}instruments/historical/${instrumentToken}/${interval}?from=${from}&to=${to}`;

    return await this.http
      .get(url, {
        headers: {
          Authorization: `token ${this.apiKey}:${this.accessToken}`,
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

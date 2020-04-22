import { Injectable, Logger, HttpService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
//@ts-ignore
import * as swingStocks from './swing-stocks';
import { AppService } from '../app.service';
import { KiteService } from '../kite.service';
@Injectable()
export class SwingService {

  private logger = new Logger('SwingService');

 
  constructor(
    private readonly appService: AppService,
    private readonly kiteService: KiteService,

  ) {
  }
  async getDetails(symbol:any){
  const instrumentToken = await this.kiteService.getInsruments(symbol);
 
    const priceAction = await this.appService.getPriceAction(instrumentToken,"day");
  
    const dayData = await this.appService.getDayData(instrumentToken,"month");
    
    const { goodOne, avg, lastCandelHeight, allowedRange } = dayData
    const { trend, valid, highestHigh, lowestLow, high, low } = priceAction;
    const data = {
      goodOne, trend, valid,symbol,
      avgCandelSize: avg,
      todayCandelSize: lastCandelHeight,
      allowedCandelSize: allowedRange,
      highestHigh, lowestLow, high, low
    }
    return data;
}

  async getSwingStocks() {
    try {
      const bag=[];
      for(let x of swingStocks){
        try {
          
      
        const data= await this.getDetails(x);
        this.logger.log('Data fetched for '+x)
        if(data.goodOne && data.trend==='DOWN' && data.valid){
          this.logger.log('Stock added in bag '+x)
          bag.push(data);
        }
       
      } catch (error) {
          
      }
      }
     
      this.logger.log('Bag is ready')
      return bag
      // return this.getDetails('TITAN')
    } catch (error) {
      throw error;
    }
  }
}

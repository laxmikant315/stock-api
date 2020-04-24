import { Injectable, Logger, HttpService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
//@ts-ignore
import * as swingStocks from './swing-stocks';
import { AppService } from '../app.service';
import { KiteService } from '../kite.service';
import { ApiCallService } from '../api-call.service';
@Injectable()
export class SwingService {

  private logger = new Logger('SwingService');

 
  constructor(
    private readonly appService: AppService,
    private readonly apiCallService: ApiCallService ,
    private readonly kiteService: KiteService,

  ) {
  }
  async getDetails(symbol:any){
  const instrument = await this.kiteService.getInsruments(symbol);
 
    const priceAction = await this.appService.getPriceAction(instrument,"day");
  
    const dayData = await this.appService.getDayData(instrument,"month");
    
    const { goodOne, avg, lastCandelHeight, allowedRange } = dayData
    const { trend, valid, highestHigh, lowestLow, high, low ,lastCandelIsGreen} = priceAction;
    const data = {
      instrument,
      goodOne, trend, valid,symbol,
      avgCandelSize: avg,
      todayCandelSize: lastCandelHeight,
      allowedCandelSize: allowedRange,
      highestHigh, lowestLow, high, low,lastCandelIsGreen
    }
    return data;
}

  async getSwingStocks(trend="DOWN") {
    try {
      const bag=[];
      const volumedStocks=await this.apiCallService.getVolumeStocks('day');
      const symbols= volumedStocks.map(x=>x.nsecode)
      
      //  const finalStocks= swingStocks.filter(x=> symbols.includes(x))
      const finalStocks=symbols;
      this.logger.log(finalStocks)
      this.logger.log('Total:'+finalStocks.length)
      for(let x of finalStocks){
        try {
          
        
          
        const data= await this.getDetails(x);

        if(data.lastCandelIsGreen && data.trend==='UP' || !data.lastCandelIsGreen && data.trend==='DOWN' ) {
          this.logger.log('Data fetched for '+x)
          if(data.trend===trend && data.valid){
            this.logger.log('Stock added in bag '+x)
            bag.push(data);
          }
        }
      
       
      } catch (error) {
          
      }
      }
     if(bag && bag.length>0){
      this.logger.log('Bag is ready')
     }else{
      this.logger.log('Better luck next time')
     }
    
      return bag
      // return this.getDetails('TITAN')
    } catch (error) {
      throw error;
    }
  }
}

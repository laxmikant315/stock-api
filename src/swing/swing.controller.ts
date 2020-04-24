import { Controller, Get, Param, Optional, Post, Body } from '@nestjs/common';

import { SwingService } from './swing.service';
import { ApiCallService } from '../api-call.service';



@Controller()
export class SwingController {
  constructor(
    private readonly service: SwingService,
    private readonly apiCallservice: ApiCallService,
 
  ) { }


  @Get('getSwingStocks')
  getSwingStocks(): any {
    return this.service.getSwingStocks();
  }

  @Get('getVolumeStocksAll')
  getVolumeStocks(): any {
    return this.apiCallservice.getVolumeStocks('day');
  }

  

}

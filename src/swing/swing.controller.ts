import { Controller, Get, Param, Optional, Post, Body } from '@nestjs/common';

import { SwingService } from './swing.service';



@Controller()
export class SwingController {
  constructor(
    private readonly service: SwingService,
  ) { }


  @Get('getSwingStocks/')
  getSwingStocks(): any {
    return this.service.getSwingStocks();
  }

}

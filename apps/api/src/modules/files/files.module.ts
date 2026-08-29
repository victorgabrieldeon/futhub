import { Global, Module } from '@nestjs/common';

import { FilesService } from './files.service.js';

@Global()
@Module({ providers: [FilesService], exports: [FilesService] })
export class FilesModule {}

import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { identity } from 'rxjs';
import { PaginationQueryDto } from 'src/common/dto/pagination-querry.dto';
import { Event } from 'src/events/entities/event.entity';
import { Any, Connection, Repository } from 'typeorm';
import { CreateCoffeeDto } from './dto/create-coffee.dto';
import { UpdateCoffeeDto } from './dto/update-coffee.dto';
import { Coffee } from './entities/coffee.entity';
import { Flavour } from './entities/flavour.entity';

@Injectable()
export class CoffeesService {
constructor(
    @InjectRepository(Coffee)
    private readonly coffeeRepository: Repository<Coffee>,
    @InjectRepository(Flavour)
    private readonly flavourRepository: Repository<Flavour>,
    private readonly connection: Connection,
){}

findAll(paginationQuerry:PaginationQueryDto){
    const {limit, offset} = paginationQuerry;
    return this.coffeeRepository.find({
        relations: ['flavours'],
        skip: offset,
        take: limit,
    });
}

async findOne(id:string){
    const coffee = await this.coffeeRepository.findOne(id,{
        relations: ['flavours']
    })
    if(!coffee){
    throw new NotFoundException(`Coffee #${id} not found`)
    }
    return coffee;
}

async create(createCoffeeDto: CreateCoffeeDto){
    const flavours = await Promise.all(
        createCoffeeDto.flavours.map(name => this.preloadFlavourByName(name))
    );
    const coffee = this.coffeeRepository.create({
        ...createCoffeeDto,
        flavours,
      })
    return this.coffeeRepository.save(coffee);
}

async update(id:string, updateCoffeeDto: UpdateCoffeeDto){
    const flavours =
    updateCoffeeDto.flavours &&
    (await Promise.all(
      updateCoffeeDto.flavours.map(name => this.preloadFlavourByName(name)),
    ));
    const coffee = await this.coffeeRepository.preload({
        id: +id,
        ...updateCoffeeDto,
        flavours,
    })
    if(!coffee){
        throw new NotFoundException(`coffee with #${id} not found`)
    }
return this.coffeeRepository.save(coffee)
    }

async remove(id:string){
    const coffee = await this.findOne(id)
    return this.coffeeRepository.remove(coffee)
}

async recommendCoffee(coffee: Coffee) {
    const queryRunner = this.connection.createQueryRunner();
    
    await queryRunner.connect();
    await queryRunner.startTransaction(); 
    try {
      coffee.recommendations++;
      
      const recommendEvent = new Event();
      recommendEvent.name = 'recommend_coffee';
      recommendEvent.type = 'coffee';
      recommendEvent.payload = { coffeeId: coffee.id };
    
      await queryRunner.manager.save(coffee); 
      await queryRunner.manager.save(recommendEvent);
      
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }
private async preloadFlavourByName(name: string): Promise<Flavour> {
    const existingFlavour = await this.flavourRepository.findOne({ name });
    if (existingFlavour) {
      return existingFlavour;
    }
    return this.flavourRepository.create({ name });
  }
}





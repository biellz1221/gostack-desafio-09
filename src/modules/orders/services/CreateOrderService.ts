import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists)
      throw new AppError('Could not find a customer with the provided ID');

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existentProducts.length) throw new AppError('Could not find products');

    const existentProductsIds = existentProducts.map(product => product.id);

    const checkInexistentProducts = products.filter(product => {
      return !existentProductsIds.includes(product.id);
    });

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Coult not find one or more products: ${checkInexistentProducts} `,
      );
    }

    const findProductsOutOfStock = products.filter(
      product =>
        existentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsOutOfStock.length) {
      throw new AppError(
        `Some products are out of stock: ${findProductsOutOfStock} `,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => {
      // console.log('Produto MAP', product);

      // console.log(product.product_id);

      // const t = existentProducts.filter(p => {
      //   return p.id === product.product_id;
      // });

      // console.log('Produto MAP t', t);

      return {
        id: product.product_id,
        quantity:
          existentProducts.filter(p => p.id === product.product_id)[0]
            .quantity - product.quantity,
      };
    });

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;

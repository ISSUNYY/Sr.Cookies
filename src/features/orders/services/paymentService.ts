import { updateOrderStatus } from './orderService';

export const processPagBemPayment = async (orderId: string, cardInfo: Record<string, unknown> | null): Promise<boolean> => {
  console.log('PagBem incoming payment processing for order:', orderId, 'card info length:', cardInfo ? Object.keys(cardInfo).length : 0);
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        // Mock PagBem payment success after 2 seconds
        await updateOrderStatus(orderId, 'PAID');
        resolve(true);
      } catch (error) {
        reject(error);
      }
    }, 2000);
  });
};

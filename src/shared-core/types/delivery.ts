/**
 * shared-core/types/delivery.ts
 * DTOs de delivery — mapeados dos TaskBean, DeskBean, DishBean do APK
 */

export interface DishBean {
  dishId: number;
  name: string;
  imageUrl?: string;
  price?: number;
  quantity: number;
}

export interface DeskBean {
  tableNumber: string;
  region?: string;
  x: number;
  y: number;
  theta?: number;
}

export type TaskStatus =
  | 'pending'
  | 'preparing'
  | 'delivering'
  | 'arrived'
  | 'confirmed'
  | 'returning'
  | 'completed'
  | 'cancelled'
  | 'error';

export type TaskPriority = 0 | 1 | 2; // 0=normal, 1=urgente, 2=crítico

export interface TaskBean {
  id: number;
  deskId: number;
  tableNumber: string;
  dishList: DishBean[];
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: number;
  updatedAt?: number;
  estimatedArrival?: number;
  notes?: string;
}

export interface MapAndTableNumberBean {
  tableNumber: string;
  x: number;
  y: number;
  theta: number;
  region?: string;
}

export interface ReceptionPointBean {
  pointId: string;
  x: number;
  y: number;
  type: 'entry' | 'exit' | 'waiting';
}

export interface WaitingPointBean {
  pointId: string;
  x: number;
  y: number;
  waitTime: number; // seconds
}

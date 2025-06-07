"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  fetchProducts, fetchRacks, fetchCategories, fetchUsers, fetchProductCodes,
  addProduct as apiAddProduct, updateProduct as apiUpdateProduct, deleteProduct as apiDeleteProduct,
  addRack as apiAddRack, updateRack as apiUpdateRack, deleteRack as apiDeleteRack,
  addCategory as apiAddCategory, updateCategory as apiUpdateCategory, deleteCategory as apiDeleteCategory,
  addUser as apiAddUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser,
  addProductCode as apiAddProductCode, updateProductCode as apiUpdateProductCode, deleteProductCode as apiDeleteProductCode
} from '@/lib/api';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

// Types
export interface Product {
  id: string
  code: string
  inbound_at: string
  outbound_at: string | null
  weight: number
  manufacturer: string
  floor?: number
}

export interface Rack {
  id: string
  name: string
  products: Product[] // 이 products 배열은 클라이언트 상태용이며, racks DB 테이블의 컬럼이 아님
  capacity: number
  line: string
}

export interface ProductCode { // DB의 product_codes 테이블과 일치하도록
  id: string          // uuid
  code: string        // text, unique
  name: string        // text
  description: string // text
  category: string    // 클라이언트 측에서는 category_id를 이 필드에 담아서 사용 (string 또는 Category['id'] 타입)
  storage_temp: number// numeric (예시, 실제 DB 컬럼에 따라 조정)
  created_at: string  // timestamptz
  updated_at: string  // timestamptz
  // category_id?: string // DB에는 이게 있고, 클라이언트 ProductCode에는 category로 통일 (선택적)
}

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface User { // DB의 users 테이블 스키마와 일치
  id: string;
  email: string;
  name: string;
  role: string;
  password?: string // 로컬 전용, DB 저장 안 함
  status: "active" | "inactive" // 애플리케이션 레벨에서 관리 (DB 스키마에 없다면)
  permissions: { page: string; view: boolean; edit: boolean }[]
}

export interface StockMovement {
  id: string;
  user_id: string;
  product_id: string;
  rack_id?: string;
  type: "IN" | "OUT" | "MOVE" | string;
  quantity: number;
  moved_at: string;
  details?: string;
}

interface StorageContextType {
  products: Product[]
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product | undefined>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>

  racks: Rack[]
  addRack: (rack: Omit<Rack, 'id' | 'products'>) => Promise<Rack | undefined> // products는 DB에 직접 저장 안 함
  updateRack: (id: string, updates: Partial<Omit<Rack, 'products'>> | Partial<Rack>) => Promise<void> // products는 별도 관리
  deleteRack: (id: string) => Promise<void>

  productCodes: ProductCode[]
  setProductCodes: React.Dispatch<React.SetStateAction<ProductCode[]>>
  addProductCode: (productCode: Omit<ProductCode, 'id' | 'created_at' | 'updated_at'>) => Promise<ProductCode | undefined>
  updateProductCode: (id: string, updates: Partial<Omit<ProductCode, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>
  deleteProductCode: (id: string) => Promise<void>

  categories: Category[]
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>
  addCategory: (category: Omit<Category, 'id' | 'created_at'>) => Promise<Category | undefined>
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id' | 'created_at'>>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  users: User[]
  addUser: (user: Omit<User, 'id'>) => Promise<User | undefined>
  updateUser: (id: string, updates: Partial<User>) => Promise<void>
  deleteUser: (id: string) => Promise<void>

  stockMovements: StockMovement[]
  lastUpdated: number
  isLoading: boolean
  refreshData: () => Promise<void>
}

const StorageContext = createContext<StorageContextType | undefined>(undefined)

interface StorageProviderProps {
  children: React.ReactNode
}

function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// 로컬 스토리지 헬퍼 함수들
const getFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to get ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const saveToLocalStorage = <T,>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};

export function StorageProvider({ children }: StorageProviderProps) {
  const [products, setProductsState] = useState<Product[]>(() => getFromLocalStorage('tad_products', []));
  const [racks, setRacksState] = useState<Rack[]>(() => getFromLocalStorage('tad_racks', []));
  const [categories, setCategoriesState] = useState<Category[]>(() => getFromLocalStorage('tad_categories', []));
  const [users, setUsersState] = useState<User[]>(() => getFromLocalStorage('tad_users', []));
  const [productCodes, setProductCodesState] = useState<ProductCode[]>(() => getFromLocalStorage('tad_productCodes', []));
  const [stockMovements, setStockMovementsState] = useState<StockMovement[]>(() => getFromLocalStorage('tad_stockMovements', []));
  const [isLoading, setIsLoadingState] = useState(true);
  const [lastRefresh, setLastRefreshState] = useState<number>(Date.now());

  // localStorage 동기화를 포함한 상태 업데이트 함수들
  const setProducts = useCallback((value: Product[] | ((prev: Product[]) => Product[])) => {
    setProductsState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToLocalStorage('tad_products', newValue);
      return newValue;
    });
  }, []);

  const setRacks = useCallback((value: Rack[] | ((prev: Rack[]) => Rack[])) => {
    setRacksState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToLocalStorage('tad_racks', newValue);
      return newValue;
    });
  }, []);

  const setCategories = useCallback((value: Category[] | ((prev: Category[]) => Category[])) => {
    setCategoriesState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToLocalStorage('tad_categories', newValue);
      return newValue;
    });
  }, []);

  const setUsers = useCallback((value: User[] | ((prev: User[]) => User[])) => {
    setUsersState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToLocalStorage('tad_users', newValue);
      return newValue;
    });
  }, []);

  const setProductCodes = useCallback((value: ProductCode[] | ((prev: ProductCode[]) => ProductCode[])) => {
    setProductCodesState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToLocalStorage('tad_productCodes', newValue);
      return newValue;
    });
  }, []);

  const setStockMovements = useCallback((value: StockMovement[] | ((prev: StockMovement[]) => StockMovement[])) => {
    setStockMovementsState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      saveToLocalStorage('tad_stockMovements', newValue);
      return newValue;
    });
  }, []);

  const mapProductFromDb = (dbProduct: any): Product => ({
    id: dbProduct.id,
    code: dbProduct.code,
    inbound_at: dbProduct.inbound_at,
    outbound_at: dbProduct.outbound_at,
    weight: dbProduct.weight,
    manufacturer: dbProduct.manufacturer,
    floor: dbProduct.floor,
  });

  const mapProductToDb = (product: Partial<Product> | Omit<Product, 'id'>): any => {
    const dbProduct: any = { ...product };
    return dbProduct;
  };

  const refreshData = useCallback(async () => {
    console.log("StorageContext: refreshData called");
    setIsLoadingState(true);
    try {
      // DB 연결 시도하되, 실패하면 로컬 데이터 유지
      try {
        const [
          productsDataDb, 
          racksDataDb, 
          categoriesDataDb, 
          usersDataDb, 
          productCodesDataDb, 
          activityLogsDataDb
        ] = await Promise.all([
          supabaseAdmin.from('products').select('*'),
          supabaseAdmin.from('racks').select('*, rack_products(product_id, floor, inbound_date, outbound_date)'),
          supabaseAdmin.from('categories').select('*').order('name'),
          supabaseAdmin.from('users').select('*').order('name'),
          supabaseAdmin.from('product_codes').select('*, category_id').order('code'),
          supabaseAdmin.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50)
        ]);

        const errors = [
          productsDataDb.error, racksDataDb.error, categoriesDataDb.error, 
          usersDataDb.error, productCodesDataDb.error, activityLogsDataDb.error
        ].filter(Boolean);

        if (errors.length > 0) {
          // DB 권한 에러는 예상된 상황이므로 warning으로 처리
          const hasPermissionErrors = errors.some(error => 
            error?.message?.includes('permission denied')
          );
          
          if (hasPermissionErrors) {
            console.warn('StorageContext: Database not configured, using local storage fallback');
          } else {
            console.warn('StorageContext: Some DB queries failed, keeping existing local data:', errors);
          }
          
          // 에러가 있어도 기존 로컬 데이터 유지
          setLastRefreshState(Date.now());
          setIsLoadingState(false);
          return;
        }
      
        setProductsState((productsDataDb.data?.map(mapProductFromDb) || []) as Product[]);

      const mappedRacks = racksDataDb.data ? racksDataDb.data.map(rack => {
        const rackProducts = (rack.rack_products || []).map((rp: any) => {
            const productDetail = productsDataDb.data?.find(p => p.id === rp.product_id);
            return {
                id: rp.product_id, 
                code: productDetail?.code || 'N/A', 
                inbound_at: rp.inbound_date, 
                outbound_at: rp.outbound_date, 
                weight: productDetail?.weight || 0, 
                manufacturer: productDetail?.manufacturer || 'N/A', 
                floor: rp.floor
            };
        });
        return {
            id: rack.id,
            name: rack.name,
            products: rackProducts as Product[],
            capacity: rack.capacity || 4,
            line: rack.line,
        };
      }) : [];
      setRacksState(mappedRacks as Rack[]);

      setCategoriesState((categoriesDataDb.data || []).map(c => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at,
      })) as Category[]);

      setUsersState((usersDataDb.data || []).map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        permissions: u.permissions || [],
        status: 'active', 
      })) as User[]);
      
      // DB 데이터와 로컬 데이터를 병합 (로컬의 temp 데이터 보존)
      const dbProductCodes = (productCodesDataDb.data || []).map(pc => ({
        id: pc.id,
        code: pc.code,
        name: pc.name,
        description: pc.description,
        category: pc.category_id,
        storage_temp: pc.storage_temp || -18,
        created_at: pc.created_at,
        updated_at: pc.updated_at,
      })) as ProductCode[];
      
      // 로컬의 temp 데이터 (temp-로 시작하는 ID) 유지
      setProductCodes(prev => {
        const localTempItems = prev.filter(item => item.id.startsWith('temp-'));
        const dbItems = dbProductCodes.filter(item => !item.id.startsWith('temp-'));
        return [...dbItems, ...localTempItems];
      });

      setStockMovementsState((activityLogsDataDb.data || []).map(log => ({
        id: log.id,
        user_id: log.user_id,
        product_id: log.product_id || 'N/A', 
        rack_id: log.rack_id, 
        type: log.action, 
        quantity: parseInt(String(log.details || log.action || "").match(/\d+/)?.[0] || "0"), // details 우선, 없으면 action에서 파싱
        moved_at: log.created_at,
        details: log.details || log.action,
      })) as StockMovement[]);

        setLastRefreshState(Date.now());
        console.log("StorageContext: refreshData successful");
      } catch (dbError: any) {
        console.warn('Database access failed completely, keeping existing local data:', dbError);
        setLastRefreshState(Date.now());
      }
    } catch (error) {
      console.error('StorageContext: Error refreshing data:', error);
    } finally {
      setIsLoadingState(false);
      console.log("StorageContext: refreshData finished, isLoading:", false);
    }
  }, []); // 의존성 배열 비워서 마운트 시에만 함수 정의

  const debouncedRefreshData = useCallback(debounce(refreshData, 1000), []);

  useEffect(() => {
    refreshData(); // 초기 데이터 로드

    const changes = supabase
      .channel('public-schema-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('StorageContext: DB Change received!', payload);
        refreshData(); // debounced 대신 직접 호출로 무한루프 방지
      })
      .subscribe();

    return () => {
      supabase.removeChannel(changes);
    };
  }, []); // 빈 의존성 배열로 마운트 시에만 실행

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastRefresh >= 5 * 60 * 1000) { // 5분
        console.log("StorageContext: Interval refresh triggered");
        refreshData();
      }
    }, 60 * 1000); 

    return () => clearInterval(intervalId);
  }, [lastRefresh]); // refreshData 의존성 제거

  // Products
  const addProductToStorage = async (product: Omit<Product, 'id'>): Promise<Product | undefined> => {
    try {
      const dbProduct = mapProductToDb(product);
      const result = await apiAddProduct(dbProduct);
      if (result && result.length > 0) {
        const newProduct = mapProductFromDb(result[0]);
        // debouncedRefreshData(); // 실시간 구독이 처리하도록 유도
        return newProduct;
      }
      throw new Error('Failed to add product: No data returned');
    } catch (error) {
      console.error('Error adding product:', error);
      throw error; // 에러를 다시 throw하여 호출부에서 처리할 수 있도록 함
    }
  };

  const updateProductInStorage = async (id: string, updates: Partial<Product>) => {
    try {
      const dbUpdates = mapProductToDb(updates);
      await apiUpdateProduct(id, dbUpdates);
      // debouncedRefreshData();
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const deleteProductFromStorage = async (id: string) => {
    try {
      await apiDeleteProduct(id);
      // debouncedRefreshData();
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  };

  // Racks
  const addRackToStorage = async (rack: Omit<Rack, 'id' | 'products'>): Promise<Rack | undefined> => {
    try {
      try {
        // apiAddRack은 이미 lib/api.ts에서 'products'를 제외한 객체를 받도록 수정됨
        const result = await apiAddRack(rack as Omit<Rack, 'id'>);
        if (result && result.length > 0) {
          // debouncedRefreshData();
          return {...result[0], products: []}; // 클라이언트 타입에 맞게 products: [] 추가
        }
        throw new Error('Failed to add rack: No data returned');
      } catch (dbError: any) {
        // DB 권한 에러는 예상된 상황이므로 간단한 메시지로 처리
        if (dbError?.message?.includes('permission denied')) {
          console.info('StorageContext: Using local storage for rack (DB not configured)');
        } else {
          console.warn('Database access failed for rack, using local fallback:', dbError);
        }
        
        // DB 접근 실패 시 로컬 상태로만 처리
        const fallbackRack: Rack = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: rack.name,
          products: [],
          capacity: rack.capacity,
          line: rack.line,
        };
        
        // 로컬 상태에 직접 추가 (localStorage 동기화 포함)
        setRacksState(prev => {
          const newValue = [...prev, fallbackRack];
          saveToLocalStorage('tad_racks', newValue);
          return newValue;
        });
        
        console.log('addRackToStorage: Added to local state only:', fallbackRack);
        return fallbackRack;
      }
    } catch (error) {
      console.error('Error adding rack:', error);
      throw error;
    }
  };

  const updateRackInStorage = async (id: string, updates: Partial<Omit<Rack, 'products'>> | Partial<Rack>) => {
    try {
      // products가 포함된 경우와 아닌 경우를 구분
      const { products, ...dbUpdates } = updates as any;
      
      if (Object.keys(dbUpdates).length > 0) {
        await apiUpdateRack(id, dbUpdates);
      }
      
      // products가 있으면 로컬 상태만 업데이트 (DB에는 products 저장 안 함)
      if (products !== undefined) {
        setRacks(prev => prev.map(rack =>
          rack.id === id ? { ...rack, products } : rack
        ));
      }
      
      // debouncedRefreshData();
    } catch (dbError: any) {
      // DB 실패 시 로컬 fallback
      setRacks(prev => prev.map(rack =>
        rack.id === id ? { ...rack, ...updates } : rack
      ));
      saveToLocalStorage('tad_racks', racks.map(rack =>
        rack.id === id ? { ...rack, ...updates } : rack
      ));
      console.warn('updateRackInStorage: Updated local state only for ID:', id);
    }
  };

  const deleteRackFromStorage = async (id: string) => {
    try {
      await apiDeleteRack(id);
      // debouncedRefreshData();
    } catch (dbError: any) {
      // DB 실패 시 로컬 fallback
      setRacks(prev => prev.filter(rack => rack.id !== id));
      saveToLocalStorage('tad_racks', racks.filter(rack => rack.id !== id));
      console.warn('deleteRackFromStorage: Removed from local state only for ID:', id);
    }
  };

  // Product Codes
  const addProductCodeToStorage = async (productCode: Omit<ProductCode, 'id' | 'created_at' | 'updated_at'>): Promise<ProductCode | undefined> => {
    try {
      const { category, ...restOfProductCode } = productCode;
      
      // timestamp 필드들 명시적으로 제거 (Supabase에서 자동 생성)
      const dbProductCodePayload = {
        code: restOfProductCode.code,
        name: restOfProductCode.name,
        description: restOfProductCode.description,
        storage_temp: restOfProductCode.storage_temp,
        category_id: category, // 'category' (ID)를 'category_id'로 매핑
      };
      
      console.log('addProductCodeToStorage: Final payload:', dbProductCodePayload);
      
      try {
        const result = await apiAddProductCode(dbProductCodePayload as any);
        if (result && result.length > 0) {
          const newDbData = result[0] as any;
          // debouncedRefreshData();
          return { // 클라이언트 ProductCode 타입으로 다시 매핑
              ...newDbData,
              category: newDbData.category_id 
          };
        }
        throw new Error('Failed to add product code: No data returned');
      } catch (dbError: any) {
        // DB 권한 에러는 예상된 상황이므로 간단한 메시지로 처리
        if (dbError?.message?.includes('permission denied')) {
          console.info('StorageContext: Using local storage for product code (DB not configured)');
        } else {
          console.warn('Database access failed, using local fallback:', dbError);
        }
        
        // DB 접근 실패 시 로컬 상태로만 처리 (임시 해결책)
        const fallbackProductCode: ProductCode = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          code: restOfProductCode.code,
          name: restOfProductCode.name,
          description: restOfProductCode.description,
          storage_temp: restOfProductCode.storage_temp,
          category: category,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        // 로컬 상태에 직접 추가 (localStorage 동기화 포함)
        setProductCodes(prev => [...prev, fallbackProductCode]);
        
        console.log('addProductCodeToStorage: Added to local state only:', fallbackProductCode);
        return fallbackProductCode;
      }
    } catch (error) {
      console.error('Error adding product code:', error);
      throw error;
    }
  };

  const updateProductCodeInStorage = async (id: string, updates: Partial<Omit<ProductCode, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { category, ...restOfUpdates } = updates;
      const dbUpdatesPayload: Partial<any> = { ...restOfUpdates };

      if (category !== undefined) {
        dbUpdatesPayload.category_id = category;
      }
      
      try {
        await apiUpdateProductCode(id, dbUpdatesPayload as any);
        // debouncedRefreshData();
      } catch (dbError: any) {
        console.warn('Database update failed for product code, using local fallback:', dbError);
        
        // DB 접근 실패 시 로컬 상태로만 처리 (localStorage 동기화 포함)
        setProductCodes(prev => prev.map(pc => 
          pc.id === id 
            ? { ...pc, ...updates, updated_at: new Date().toISOString() }
            : pc
        ));
        
        console.log('updateProductCodeInStorage: Updated local state only for ID:', id);
      }
    } catch (error) {
      console.error('Error updating product code:', error);
      throw error;
    }
  };

  const deleteProductCodeFromStorage = async (id: string) => {
    try {
      try {
        await apiDeleteProductCode(id);
        // debouncedRefreshData();
      } catch (dbError: any) {
        console.warn('Database delete failed for product code, using local fallback:', dbError);
        
        // DB 접근 실패 시 로컬 상태에서만 제거 (localStorage 동기화 포함)
        setProductCodes(prev => prev.filter(pc => pc.id !== id));
        
        console.log('deleteProductCodeFromStorage: Removed from local state only for ID:', id);
      }
    } catch (error) {
      console.error('Error deleting product code:', error);
      throw error;
    }
  };

  // Categories
  const addCategoryToStorage = async (category: Omit<Category, 'id' | 'created_at'>): Promise<Category | undefined> => {
    try {
      try {
        const result = await apiAddCategory(category as Omit<Category, 'id'>);
        if (result && result.length > 0) {
          // debouncedRefreshData();
          return result[0];
        }
        throw new Error('Failed to add category: No data returned');
      } catch (dbError: any) {
        // DB 권한 에러는 예상된 상황이므로 간단한 메시지로 처리
        if (dbError?.message?.includes('permission denied')) {
          console.info('StorageContext: Using local storage for category (DB not configured)');
        } else {
          console.warn('Database access failed for category, using local fallback:', dbError);
        }
        
        // DB 접근 실패 시 로컬 상태로만 처리
        const fallbackCategory: Category = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: category.name,
          created_at: new Date().toISOString(),
        };
        
        // 로컬 상태에 직접 추가 (localStorage 동기화 포함)
        setCategories(prev => [...prev, fallbackCategory]);
        
        console.log('addCategoryToStorage: Added to local state only:', fallbackCategory);
        return fallbackCategory;
      }
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  };

  const updateCategoryInStorage = async (id: string, updates: Partial<Omit<Category, 'id' | 'created_at'>>) => {
    try {
      await apiUpdateCategory(id, updates);
      // debouncedRefreshData();
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  };

  const deleteCategoryFromStorage = async (id: string) => {
    try {
      await apiDeleteCategory(id);
      // debouncedRefreshData();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  };

  // Users
  const addUserToStorage = async (user: Omit<User, 'id'>): Promise<User | undefined> => {
    try {
      // DB에 저장 시 password는 해싱하거나 auth.users 테이블을 사용해야 함.
      // 현재 users 테이블에 직접 저장하는 방식은 보안상 문제가 될 수 있으므로,
      // 실제 API 호출 시 password는 제외하거나 별도 처리 필요.
      const { password, ...userToInsert } = user;
      const result = await apiAddUser(userToInsert as Omit<User, 'id' | 'password'>);
      if (result && result.length > 0) {
        return result[0];
      }
      throw new Error('Failed to add user: No data returned');
    } catch (dbError: any) {
      // DB 실패 시 무조건 로컬 fallback
      const fallbackUser: User = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
      };
      setUsers(prev => {
        const newValue = [...prev, fallbackUser];
        saveToLocalStorage('tad_users', newValue);
        return newValue;
      });
      console.log('addUserToStorage: Added to local state only:', fallbackUser);
      return fallbackUser;
    }
  };

  const updateUserInStorage = async (id: string, updates: Partial<User>) => {
    try {
      const { password, ...updatesForDb } = updates;
      await apiUpdateUser(id, updatesForDb);
      // debouncedRefreshData();
    } catch (dbError: any) {
      // DB 실패 시 로컬 fallback
      setUsers(prev => prev.map(user => user.id === id ? { ...user, ...updates } : user));
      saveToLocalStorage('tad_users', users.map(user => user.id === id ? { ...user, ...updates } : user));
      console.warn('updateUserInStorage: Updated local state only for ID:', id);
    }
  };

  const deleteUserFromStorage = async (id: string) => {
    try {
      await apiDeleteUser(id);
      // debouncedRefreshData();
    } catch (dbError: any) {
      // DB 실패 시 로컬 fallback
      setUsers(prev => prev.filter(user => user.id !== id));
      saveToLocalStorage('tad_users', users.filter(user => user.id !== id));
      console.warn('deleteUserFromStorage: Removed from local state only for ID:', id);
    }
  };

  return (
    <StorageContext.Provider value={{
      products, addProduct: addProductToStorage, updateProduct: updateProductInStorage, deleteProduct: deleteProductFromStorage,
      racks, addRack: addRackToStorage, updateRack: updateRackInStorage, deleteRack: deleteRackFromStorage,
      productCodes, setProductCodes, addProductCode: addProductCodeToStorage, updateProductCode: updateProductCodeInStorage, deleteProductCode: deleteProductCodeFromStorage,
      categories, setCategories, addCategory: addCategoryToStorage, updateCategory: updateCategoryInStorage, deleteCategory: deleteCategoryFromStorage,
      users, addUser: addUserToStorage, updateUser: updateUserInStorage, deleteUser: deleteUserFromStorage,
      stockMovements,
      lastUpdated: lastRefresh,
      isLoading,
      refreshData
    }}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const context = useContext(StorageContext)
  if (context === undefined) {
    throw new Error("useStorage must be used within a StorageProvider")
  }
  return context
}

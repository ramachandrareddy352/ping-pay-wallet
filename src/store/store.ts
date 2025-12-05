import {configureStore} from '@reduxjs/toolkit';
import walletSlice from './features/wallet';
import walletSignSlice from './features/wallet_sign';
export const store = configureStore({
  reducer: {
    wallet: walletSlice,
    wallet_sign: walletSignSlice,
  },
});

// Infer types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

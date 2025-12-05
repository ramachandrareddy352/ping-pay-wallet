// store/popupSlice.ts
import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export enum SignPopUpState {
  READY = 0,
  PREVIEW = 1,
  LOADING = 2,
  COMPLETE = 3,
  FAILED = 4,
}

export interface TransactionPopUpParams {
  networkFees: string;
  info: string;
  values: {
    amount: number;
    symbol: string;
  }[];
}
interface WalletPopUpState {
  status: SignPopUpState;
  type: 'message' | 'transaction';
  tx?: TransactionPopUpParams;
  message?: {
    label: string;
    content: string;
  };
}

const initialState: WalletPopUpState = {
  status: SignPopUpState.READY,
  type: 'message',
};

const popupSlice = createSlice({
  name: 'wallet-popup',
  initialState,
  reducers: {
    setMessage: (
      state,
      action: PayloadAction<{
        message: WalletPopUpState['message'];
        status: SignPopUpState;
      }>,
    ) => {
      if (state.status === SignPopUpState.READY) {
        console.log('reached herer ');
        state.message = action.payload.message;
        state.status = action.payload.status;
        state.type = 'message';
      } else {
        console.log('A sign confirmation is in progress');
      }
    },

    setTransaction: (
      state,
      action: PayloadAction<Pick<WalletPopUpState, 'tx'>>,
    ) => {
      if (state.status === SignPopUpState.READY) {
        state.tx = action.payload.tx;
        state.status = SignPopUpState.PREVIEW;
        state.type = 'transaction';
      } else {
        console.log('A sign confirmation is in progress');
      }
    },
    setStatus: (state, action: PayloadAction<SignPopUpState>) => {
      state.status = action.payload;
    },
  },
});

export const {setMessage, setStatus, setTransaction} = popupSlice.actions;
export default popupSlice.reducer;

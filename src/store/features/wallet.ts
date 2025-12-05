import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {WalletData} from '../../../utils/storage';

type WalletState = {
  data: WalletData;
};

const initialState: WalletState = {
  data: {
    accounts: [],
    currentAccountId: null,
    network: 'devnet',
    bookmarks: [],
    lastRevealedIndex: 0,
    nextDerivedIndex: 0,
  },
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setWalletData: (state, action: PayloadAction<WalletData>) => {
      state.data = action.payload;
    },
  },
});

export const {setWalletData} = walletSlice.actions;

export default walletSlice.reducer;

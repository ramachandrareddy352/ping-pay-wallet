import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../store/store';
import CloseIcon from '../../assets/icons/close-icon.svg';
import {
  setMessage,
  setStatus,
  setTransaction,
  SignPopUpState,
  TransactionPopUpParams,
} from '../store/features/wallet_sign';

// Callbacks type
type PopupCallbacks = {
  onConfirm?: () => void;
  onCancel?: () => void;
};

// Context type
interface SignPopupContextType {
  showMessage: (
    label: string,
    content: string,
    callbacks?: PopupCallbacks,
  ) => void;
  showTransaction: (
    params: TransactionPopUpParams,
    callbacks?: PopupCallbacks,
  ) => void;
  setSuccess: () => void;
  setFailed: () => void;
  setReady: () => void;
}

const SignPopupContext = createContext<SignPopupContextType | undefined>(
  undefined,
);

interface SignPopupProviderProps {
  children: ReactNode;
}

export const SignPopupProvider: React.FC<SignPopupProviderProps> = ({
  children,
}) => {
  const dispatch = useDispatch();
  const {status, type, message, tx} = useSelector(
    (state: RootState) => state.wallet_sign,
  );
  const callbacksRef = React.useRef<PopupCallbacks>({});

  const visible = useMemo(() => {
    return status !== SignPopUpState.READY;
  }, [status]);

  useEffect(() => {
    // console.log('status here', status);
  }, [status]);

  useEffect(() => {
    // console.log('message new', message);
  }, [message]);

  const showMessage = useCallback(
    (label: string, content: string, callbacks?: PopupCallbacks) => {
      if (status === SignPopUpState.READY) {
        console.log('wallet show message called');
        dispatch(
          setMessage({
            message: {label, content},
            status: SignPopUpState.PREVIEW,
          }),
        );
        dispatch(setStatus(SignPopUpState.PREVIEW));
        callbacksRef.current = callbacks || {};
      } else {
        console.log('A sign confirmation is in progress');
      }
    },
    [dispatch, status],
  );

  const showTransaction = (
    params: TransactionPopUpParams,
    callbacks?: PopupCallbacks,
  ) => {
    if (status === SignPopUpState.READY) {
      dispatch(setTransaction({tx: params}));
      callbacksRef.current = callbacks || {};
    } else {
      console.log('A sign confirmation is in progress');
    }
  };

  const handleCancel = () => {
    callbacksRef.current.onCancel?.();
    setReady();
  };

  const handleConfirm = () => {
    callbacksRef.current.onConfirm?.();
    dispatch(setStatus(SignPopUpState.LOADING));
  };

  const setSuccess = () => dispatch(setStatus(SignPopUpState.COMPLETE));
  const setFailed = () => {
    console.log('set failed called');
    dispatch(setStatus(SignPopUpState.FAILED));
  };
  const setReady = () => dispatch(setStatus(SignPopUpState.READY));

  const displayContent = type === 'message' ? message?.content : tx?.info ?? '';

  // Dynamic status UI
  const renderContent = () => {
    switch (status) {
      case SignPopUpState.LOADING:
        return (
          <View className="w-full flex-col justify-center items-center py-10 bg-[#1C1C1E] rounded-3xl">
            <ActivityIndicator size="large" color="#9F7AEA" />
            <Text className="text-gray-300 text-base mt-3">Processing...</Text>
          </View>
        );
      case SignPopUpState.COMPLETE:
        return (
          <View className="flex-col justify-center items-center py-10 px-6 bg-[#1C1C1E] rounded-3xl">
            <View className="bg-green-800/20 border border-green-500/40 rounded-full p-5 mb-4">
              <Text className="text-green-400 text-4xl">✔</Text>
            </View>
            <Text className="text-green-400 text-2xl font-MetropolisBold mb-2">
              Success!
            </Text>
            <Text className="text-gray-300 text-center text-base mb-6 leading-5">
              {type === 'transaction'
                ? 'Your transaction has been completed successfully.'
                : 'Message signed successfully and verified.'}
            </Text>
            <TouchableOpacity
              className="bg-gradient-to-r from-[#43e97b] to-[#38f9d7] w-full py-3 rounded-xl active:opacity-80"
              onPress={setReady}>
              <Text className="text-black text-center font-MetropolisMedium text-base">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        );

      case SignPopUpState.FAILED:
        return (
          <View className="flex-col justify-center items-center py-10 px-6 bg-[#1C1C1E] rounded-3xl">
            <View className="bg-red-900/20 border border-red-500/40 rounded-full p-5 mb-4">
              <Text className="text-red-400 text-4xl">✖</Text>
            </View>
            <Text className="text-red-400 text-2xl font-MetropolisBold mb-2">
              Failed
            </Text>
            <Text className="text-gray-300 text-center text-base mb-6 leading-5">
              {type === 'transaction'
                ? 'The transaction could not be completed.'
                : 'Message signing was unsuccessful.'}
            </Text>
            <TouchableOpacity
              className="bg-[#2C2C2E] w-full py-3 rounded-xl active:opacity-80"
              onPress={setReady}>
              <Text className="text-gray-200 text-center font-MetropolisMedium text-base">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        );
      case SignPopUpState.PREVIEW:
      default:
        return (
          <View className="w-full flex-col px-2">
            <View className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-6 shadow-md">
              <Text className="text-white text-lg font-MetropolisBold mb-4">
                {type === 'message' ? 'Message Preview' : 'Transaction Details'}
              </Text>

              {/* Info */}
              {tx?.info && (
                <View className="mb-4">
                  <Text className="text-gray-400 text-sm mb-1">Info</Text>
                  <Text className="text-gray-200 text-base font-MetropolisMedium leading-5">
                    {tx.info}
                  </Text>
                </View>
              )}

              {/* Token Values */}
              {tx && tx?.values?.length > 0 && (
                <View className="mb-4">
                  <Text className="text-gray-400 text-sm mb-2">Amounts</Text>
                  {tx.values.map((v, idx) => (
                    <View
                      key={idx}
                      className="flex-row justify-between items-center py-2 bg-[#2C2C2E] rounded-lg px-3 mb-1">
                      <Text className="text-gray-200 text-base font-MetropolisMedium">
                        {v.symbol}
                      </Text>
                      <Text className="text-white text-base font-MetropolisBold">
                        {v.amount}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Network Fees */}
              {type === 'transaction' && (
                <View className="border-t border-[#3A3A3C] pt-3">
                  <Text className="text-gray-400 text-sm mb-1">
                    Network Fees
                  </Text>
                  <Text className="text-gray-100 text-base font-MetropolisMedium">
                    {tx?.networkFees || '0'} SOL
                  </Text>
                </View>
              )}
            </View>

            {/* Buttons */}
            <View className="flex-row justify-center gap-2 mt-4">
              <TouchableOpacity
                onPress={handleCancel}
                className="bg-[#2C2C2E] px-5 py-3 rounded-xl w-[48%] active:opacity-80">
                <Text className="text-gray-200 font-MetropolisMedium text-center">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                className="bg-primary px-5 py-3 rounded-xl w-[48%] active:opacity-80">
                <Text className="text-white font-MetropolisMedium text-center">
                  {type === 'message' ? 'Sign Message' : 'Sign Transaction'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <SignPopupContext.Provider
      value={{showMessage, showTransaction, setSuccess, setFailed, setReady}}>
      {children}
      <View className="">
        <Modal
          visible={visible}
          transparent
          animationType="slide"
          className=""
          onRequestClose={handleCancel}>
          <View className="z-20 absolute bottom-0 bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl px-2 py-2 shadow-l">
            <View className=" bg-[rgba(0, 0, 0, 0.6)] ">
              {/* Backdrop */}
              <TouchableOpacity
                className="absolute inset-0 bg-black opacity-50"
                onPress={handleCancel}
              />
              {/* Popup Container */}
              <View className="bg-gray-1500 rounded-t-2xl p-5">
                {/* Header */}
                {status === SignPopUpState.PREVIEW && (
                  <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-blue-1000 font-redHatBold text-lg">
                      Confirm Signature
                    </Text>
                    <TouchableOpacity onPress={handleCancel}>
                      <CloseIcon width={20} height={20} />
                    </TouchableOpacity>
                  </View>
                )}
                {renderContent()}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SignPopupContext.Provider>
  );
};

export const useSignPopup = (): SignPopupContextType => {
  const context = useContext(SignPopupContext);
  if (!context) {
    throw new Error('useSignPopup must be used within a SignPopupProvider');
  }
  return context;
};

export default SignPopupProvider;

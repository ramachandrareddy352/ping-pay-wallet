import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  ActivityIndicator,
  Keyboard,
} from 'react-native';

interface PopupState {
  visible: boolean;
  message: string;
  onOk?: () => void;
}

interface PopupContextProps {
  showPopup: (message: string, onOk?: () => void) => void;
  hidePopup: () => void;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

const PopupContext = createContext<PopupContextProps | undefined>(undefined);

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
};

export const PopupProvider = ({ children }: { children: ReactNode }) => {
  /* ----------------------------- Popup State ----------------------------- */
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    message: '',
    onOk: undefined,
  });

  const showPopup = (message: string, onOk?: () => void) => {
    setPopup({ visible: true, message, onOk });
  };

  const hidePopup = () => {
    setPopup(prev => ({ ...prev, visible: false }));
  };

  const handleOk = () => {
    hidePopup();
    if (popup.onOk) {
      popup.onOk();
    }
  };

  /* ---------------------------- Loading State ---------------------------- */
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showLoading = (message?: string) => {
    Keyboard.dismiss();
    setLoadingText(message || 'Loading...');
    setLoadingVisible(true);
  };

  const hideLoading = () => {
    setLoadingVisible(false);
  };

  useEffect(() => {
    if (loadingVisible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [loadingVisible]);

  /* --------------------------- Context Value --------------------------- */
  const contextValue = useMemo(
    () => ({
      showPopup,
      hidePopup,
      showLoading,
      hideLoading,
    }),
    [],
  );

  /* ------------------------------ Render ------------------------------- */
  return (
    <PopupContext.Provider value={contextValue}>
      {children}

      {/* Popup */}
      <Modal
        visible={popup.visible}
        transparent
        animationType="fade"
        onRequestClose={hidePopup}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-8">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-center text-blue-1000 font-MetropolisMedium text-base mb-6">
              {popup.message}
            </Text>

            <Pressable
              onPress={handleOk}
              className="bg-blue-1100 rounded-[12px] py-2 h-[60px] flex items-center justify-center"
            >
              <Text className="text-white font-MetropolisSemibold text-base">
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {loadingVisible && (
        <View className="flex-1 items-center justify-center bg-[rgba(255,255,255,0.8)] absolute top-0 bottom-0 h-full w-full z-50">
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            }}
            className="bg-white rounded-[16px] px-6 py-10 w-[80%] items-center shadow-lg"
          >
            <ActivityIndicator size="large" color="#1E293B" />
            <Text className="text-[#1E293B] text-center text-lg mt-4">
              {loadingText}
            </Text>
          </Animated.View>
        </View>
      )}
    </PopupContext.Provider>
  );
};

import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Modal } from 'react-native';
import HomeWhiteIcon from '../assets/icons/home-white.svg';
import HomeIcon from '../assets/icons/home-icon.svg';
import ExploreIcon from '../assets/icons/search-icon.svg';
import HistoryIcon from '../assets/icons/clock.svg';
import RewardsIcon from '../assets/icons/rewards.svg';
import SwapIcon from '../assets/icons/swap-vertical.svg';
import { useNavigation } from '@react-navigation/native';

type BottomNavBarProps = {
  active: 'Explore' | 'Swap' | 'Home' | 'History' | 'Rewards' | 'null';
};

export default function BottomNavBar({ active }: BottomNavBarProps) {
  const navigation = useNavigation<any>();
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);

  const tabs = [
    { label: 'Explore', Icon: ExploreIcon, route: 'Explore' },
    { label: 'Swap', Icon: SwapIcon, route: 'Swap' },
    { label: 'Home', Icon: HomeIcon, route: 'Home' },
    { label: 'History', Icon: HistoryIcon, route: 'TransactionHistory' },
    { label: 'Rewards', Icon: RewardsIcon, route: 'Rewards' },
  ];

  return (
    <View className="flex-row justify-around items-center bg-[#0B0B0E] h-[70px] border-t border-gray-800">
      {tabs.map(({ label, Icon, route }, index) => {
        const isActive = active === label;
        const isHome = label === 'Home';
        const isHistory = label === 'History';

        // 🟣 Home Tab (center special)
        if (isHome) {
          return (
            <TouchableOpacity
              key={index}
              onPress={() => navigation.replace(route)}
              activeOpacity={0.8}
              className="items-center justify-center -mt-2"
            >
              <View
                className={`${
                  isActive
                    ? 'bg-[#c916ed] shadow-purple-400/60 border-2 w-14 h-14'
                    : 'bg-[#662473] w-12 h-12'
                }  rounded-2xl flex items-center justify-center shadow-lg`}
              >
                {isActive ? (
                  <HomeWhiteIcon width={32} height={32} />
                ) : (
                  <HomeIcon width={22} height={22} />
                )}
              </View>
            </TouchableOpacity>
          );
        }

        // 🟪 Other Tabs (with top indicator)
        return (
          <TouchableOpacity
            key={index}
            className="items-center justify-center relative"
            onPress={
              isHistory
                ? () => setShowHistoryMenu(true)
                : () => navigation.replace(route)
            }
          >
            <View className="flex items-center">
              {/* 🔹 Active line at top of icon */}
              {isActive && (
                <View className="absolute top-[-10px] w-14 h-[2px] bg-[#9707B5] rounded-full" />
              )}
              <Icon width={isActive ? 24 : 20} height={isActive ? 24 : 20} />
              <Text
                className={`  mt-2 ${
                  isActive ? 'text-white text-sm' : 'text-gray-400 text-xs'
                }`}
              >
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* History Dropup Menu */}
      <Modal visible={showHistoryMenu} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowHistoryMenu(false)}
        >
          <View
            style={{
              position: 'absolute',
              bottom: 70,
              left: 0,
              right: 0,
              backgroundColor: 'transparent',
              alignItems: 'center',
            }}
          >
            <View className="bg-gray-900 rounded-xl p-4 w-48 border border-gray-700 shadow-2xl">
              <TouchableOpacity
                onPress={() => {
                  setShowHistoryMenu(false);
                  navigation.replace('TransactionHistoryStore');
                }}
                className="py-3 px-4 rounded-lg"
              >
                <Text className="text-white text-sm font-medium">
                  Store History
                </Text>
              </TouchableOpacity>
              <View className="h-px bg-gray-700 my-2" />
              <TouchableOpacity
                onPress={() => {
                  setShowHistoryMenu(false);
                  navigation.replace('TransactionHistory');
                }}
                className="py-3 px-4 rounded-lg"
              >
                <Text className="text-white text-sm font-medium">
                  Onchain History
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Linking,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { WebView } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';
import Offline from '../../assets/icons/offline.svg';

import { RootStackParamList } from '../../types/navigation';
import { NFTCompleteMetadata } from '../../types/dataTypes';

import BackArrowIcon from '../../assets/icons/back-arrow.svg';
import CopyIcon from '../../assets/icons/Copy-icon.svg';
import SendIcon from '../../assets/icons/send-icon.svg';
import BuyIcon from '../../assets/icons/buy-icon.svg';
import SaveIcon from '../../assets/icons/save-icon.svg';
import SavedIcon from '../../assets/icons/saved-fill.svg';
import OpenLink from '../../assets/icons/open-link.svg';
import Explore from '../../assets/icons/explore-white.svg';
import Download from '../../assets/icons/download.svg';

import { loadWallet, saveWallet, WalletData } from '../../utils/storage';
import {
  fetchNFTCompleteMetadata,
  getExtensionFromMime,
} from '../../utils/fetch_nft';
import BottomNavBar from '../../components/BottomNavBar';

type Props = NativeStackScreenProps<RootStackParamList, 'NFTDataScreen'>;

const { width } = Dimensions.get('window');

export default function NFTDataScreen({ route, navigation }: Props) {
  const { mintAddress } = route.params;

  const [network, setNetwork] = useState<'devnet' | 'mainnet-beta'>('devnet');
  const [metadata, setMetadata] = useState<NFTCompleteMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggleSave, setToggleSave] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Monitor internet connection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (!state.isConnected) {
        Toast.show({
          type: 'error',
          text1: 'Check your Internet connection!',
        });
      }
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const w = await loadWallet();
      if (w) {
        setNetwork(w.network);
        setToggleSave(w.bookmarks?.includes(mintAddress) ?? false);
      }
    })();
  }, []);

  useEffect(() => {
    if (mintAddress && network) fetchData();
  }, [mintAddress, network, isConnected]);

  const fetchData = async () => {
    if (!isConnected) {
      return;
    }

    setLoading(true);
    setMetadata(null);
    try {
      const result = await fetchNFTCompleteMetadata(mintAddress, network);
      setMetadata(result);
    } catch (e) {
      console.log('fetchData error', e);
      Toast.show({ type: 'error', text1: 'Failed to load NFT' });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    if (!isConnected) {
      return;
    }

    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleCopyMint = (text: string) => {
    Clipboard.setString(text);
    Toast.show({ type: 'success', text1: 'Address copied to clipboard' });
  };

  const handleOpenJson = () => {
    const url = metadata?.json_uri;
    if (url)
      Linking.openURL(url).catch(() =>
        Toast.show({ type: 'error', text1: 'Cannot open URL' }),
      );
    else Toast.show({ type: 'info', text1: 'No JSON uri available' });
  };

  const handleOpenExternal = () => {
    const url = metadata?.external_url;
    if (url)
      Linking.openURL(url).catch(() =>
        Toast.show({ type: 'error', text1: 'Cannot open URL' }),
      );
    else Toast.show({ type: 'info', text1: 'No external url available' });
  };

  const handleSend = () => {
    // navigate to send flow with mintAddress (NFT transfer)
    navigation.navigate('SendRecipient', { mintAddress, isNFT: true });
  };

  const handleBuy = () => {
    // prefer external_url, otherwise show a toast
    if (metadata?.external_url) {
      Linking.openURL(metadata.external_url).catch(() =>
        Toast.show({ type: 'error', text1: 'Cannot open external link' }),
      );
    } else {
      Toast.show({ type: 'info', text1: 'No marketplace link available' });
    }
  };

  const toggleBookmark = async () => {
    const walletData = await loadWallet();
    if (!walletData) return;

    const currentBookmarks = walletData.bookmarks || [];
    let updatedBookmarks;

    if (currentBookmarks.includes(mintAddress)) {
      updatedBookmarks = currentBookmarks.filter(addr => addr !== mintAddress);
    } else {
      updatedBookmarks = [...currentBookmarks, mintAddress];
    }

    const updatedWallet: WalletData = {
      ...walletData,
      bookmarks: updatedBookmarks,
    };

    await saveWallet(updatedWallet);
    setToggleSave(!toggleSave);
    Toast.show({
      type: 'success',
      text1: toggleSave ? 'Removed from bookmarks' : 'Added to bookmarks',
    });
  };

  const handleSaveMedia = async () => {
    if (!metadata)
      return Toast.show({ type: 'info', text1: 'No NFT data found' });

    const firstFile =
      metadata.files && metadata.files.length > 0 ? metadata.files[0] : null;
    const mediaUri =
      firstFile?.cdn_uri || firstFile?.uri || metadata.image || null;
    if (!mediaUri) {
      return Toast.show({ type: 'info', text1: 'No media to download' });
    }

    try {
      setDownloading(true);
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Toast.show({ type: 'error', text1: 'Permission denied' });
          return;
        }
      }

      const mime = firstFile?.mime || '';
      const ext = getExtensionFromMime(mime, mediaUri);
      const filename = `${(metadata.name || 'NFT').replace(
        /[^a-zA-Z0-9.-]/g,
        '_',
      )}${ext}`;
      const localPath = `${RNFS.CachesDirectoryPath}/${filename}`;

      const download = await RNFS.downloadFile({
        fromUrl: mediaUri,
        toFile: localPath,
      }).promise;

      if (download.statusCode === 200) {
        const isImage =
          mime.startsWith('image/') ||
          ext.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
        const isVideo =
          mime.startsWith('video/') || ext.match(/\.(mp4|mov|webm)$/i);

        if (isImage || isVideo) {
          await CameraRoll.save(localPath, {
            type: isImage ? 'photo' : 'video',
          });
          Toast.show({ type: 'success', text1: 'Media saved to gallery' });
        } else {
          const destPath = `${RNFS.DownloadDirectoryPath}/${filename}`;
          await RNFS.moveFile(localPath, destPath);
          Toast.show({ type: 'success', text1: 'Media saved to downloads' });
        }
      } else {
        Toast.show({ type: 'error', text1: 'Failed to download media' });
      }

      // Clean up temp file
      await RNFS.unlink(localPath);
    } catch (err) {
      console.log('Download error', err);
      Toast.show({ type: 'error', text1: 'Error saving media' });
    } finally {
      setDownloading(false);
    }
  };

  const handleExplorer = () => {
    const clusterParam = network === 'devnet' ? '?cluster=devnet' : '';
    const url = `https://explorer.solana.com/address/${mintAddress}${clusterParam}`;
    Linking.openURL(url).catch(() =>
      Toast.show({ type: 'error', text1: 'Cannot open explorer URL' }),
    );
  };

  const renderMedia = () => {
    // pick best media: files[0].cdn_uri || files[0].uri || image
    if (!metadata) return null;
    const firstFile =
      metadata.files && metadata.files.length > 0 ? metadata.files[0] : null;
    const mediaUri =
      firstFile?.cdn_uri || firstFile?.uri || metadata.image || null;
    const mime = firstFile?.mime || '';

    if (!mediaUri) {
      return (
        <View className="w-full h-64 bg-gray-800 rounded-lg items-center justify-center">
          <Text className="text-gray-400">No media available</Text>
        </View>
      );
    }

    if (
      mime.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif)$/i.test(mediaUri)
    ) {
      // GIFs sometimes work with Image; if they don't, WebView fallback is OK
      if (
        mediaUri?.startsWith('https://ipfs.io') ||
        mime.includes('gif') ||
        /\.gif$/i.test(mediaUri)
      ) {
        // WebView handles animated gifs reliably
        return (
          <View
            style={{
              width: '100%',
              height: 320,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <WebView source={{ uri: mediaUri }} style={{ flex: 1 }} />
          </View>
        );
      }
      return (
        <Image
          source={{ uri: mediaUri }}
          className="w-full"
          style={{ width: width - 32, height: 320, borderRadius: 12 }}
          resizeMode="cover"
        />
      );
    }

    if (mime.startsWith('video/') || /\.mp4$/i.test(mediaUri)) {
      return (
        <View
          style={{
            width: width - 32,
            height: 320,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <Video
            source={{ uri: mediaUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            controls
          />
        </View>
      );
    }

    // Fallback: show webview for anything else
    return (
      <View
        style={{
          width: '100%',
          height: 320,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <WebView source={{ uri: mediaUri }} style={{ flex: 1 }} />
      </View>
    );
  };

  if (!isConnected) {
    return (
      <View className="flex-1 bg-black">
        <View className="flex-1 justify-center items-center">
          <Offline width={80} height={80} />
          <Text className="text-white text-lg mt-6 font-semibold">
            Please connect to the internet
          </Text>
        </View>
        <BottomNavBar active="null" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Header */}
        <View className="flex-row items-center px-0 py-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            className="p-2"
          >
            <BackArrowIcon width={16} height={16} fill="#9707B5" />
          </TouchableOpacity>
          <Text className="text-white text-base font-medium mx-4">
            Collectible
          </Text>
        </View>

        {/* Title and mint */}
        <View className="px-4 flex-row justify-between items-center">
          <View>
            <Text className="text-white text-xl font-semibold mb-1">
              {loading ? 'Loading...' : metadata?.name || 'Unknown NFT'}
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-400 text-sm">
                {metadata?.symbol ? metadata.symbol : '—'}
              </Text>
            </View>
          </View>
          <View>
            <TouchableOpacity onPress={toggleBookmark} className="ml-2">
              {toggleSave ? (
                <SavedIcon width={22} height={22} fill="#9707B5" />
              ) : (
                <SaveIcon width={22} height={22} fill="#9707B5" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Media */}
        <View className="items-center my-4">
          {loading ? (
            <View
              style={{
                width: width - 32,
                height: 320,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator size="large" color="#9707B5" />
            </View>
          ) : (
            renderMedia()
          )}
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-gray-900 py-3 rounded-2xl items-center justify-center gap-1 shadow-lg shadow-purple-950 active:shadow-md active:scale-95 transition-all duration-200"
            onPress={handleSend}
          >
            <SendIcon width={16} height={16} />
            <Text className="text-xs font-normal text-white">Send</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-gray-900 py-3 rounded-2xl items-center justify-center gap-1 shadow-lg shadow-blue-950 active:shadow-md active:scale-95 transition-all duration-200"
            onPress={handleSaveMedia}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color="#9707B5" />
            ) : (
              <Download width={24} height={24} />
            )}
            <Text className="text-xs font-normal text-white">Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-gray-900 py-3 rounded-2xl items-center justify-center gap-1 shadow-lg shadow-green-950 active:shadow-md active:scale-95 transition-all duration-200"
            onPress={handleExplorer}
          >
            <Explore width={22} height={22} />
            <Text className="text-xs font-normal text-white">Explorer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-gray-900 py-3 rounded-2xl items-center justify-center gap-1 shadow-lg shadow-orange-950 active:shadow-md active:scale-95 transition-all duration-200"
            onPress={handleBuy}
          >
            <BuyIcon width={16} height={16} />
            <Text className="text-xs font-normal text-white">Buy</Text>
          </TouchableOpacity>
        </View>

        {/* Attributes */}
        {metadata?.attributes && metadata.attributes.length > 0 && (
          <View className="mt-4">
            <Text className="text-gray-400 text-sm mb-2">Attributes</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {metadata.attributes.map((attr, idx) => {
                const key = attr.trait_type ?? `attr-${idx}`;
                const val = attr.value ?? '-';
                return (
                  <View
                    key={`${key}-${idx}`}
                    style={{
                      backgroundColor: '#111827',
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      marginRight: 8,
                      marginBottom: 8,
                      minWidth: 80,
                    }}
                  >
                    <Text
                      style={{
                        color: '#9CA3AF',
                        fontSize: 11,
                        textAlign: 'center',
                      }}
                    >
                      {key}
                    </Text>
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 13,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      {String(val)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Description */}
        <View className="mt-4">
          <Text className="text-gray-400 text-sm mb-2">Description</Text>
          <Text className="text-white text-sm">
            {metadata?.description || 'No description provided.'}
          </Text>
        </View>

        {/* Extra metadata (grouping, creators, royalty, links) */}
        <View className="mt-6">
          <View className="bg-gray-900 rounded-lg p-4">
            {/* Grouping Section */}
            <View className="mb-4">
              <Text className="text-white text-base font-medium mb-2">
                Groupings
              </Text>
              <View className="bg-gray-800 rounded-md p-2">
                {metadata?.grouping?.map((g, i) => (
                  <View
                    key={i}
                    className="flex-row justify-between mb-3 last:mb-0"
                  >
                    <Text className="text-gray-400 text-sm">{g.group_key}</Text>
                    <View className="flex-row items-center">
                      <Text className="text-white text-sm font-medium mr-2">
                        {g.group_value.slice(0, 4)}...{g.group_value.slice(-4)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleCopyMint(g.group_value)}
                      >
                        <CopyIcon width={16} height={16} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {(!metadata?.grouping || metadata.grouping.length === 0) && (
                  <Text className="text-white text-sm font-medium">—</Text>
                )}
              </View>
            </View>

            {/* NFT */}
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">NFT</Text>
              <View className="flex-row items-center">
                <Text className="text-white text-sm font-medium mr-2">
                  {mintAddress.slice(0, 4)}...{mintAddress.slice(-4)}
                </Text>
                <TouchableOpacity onPress={() => handleCopyMint(mintAddress)}>
                  <CopyIcon width={16} height={16} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Creators Section */}
            <View className="mb-4">
              <Text className="text-white text-base font-medium mb-2">
                Creators
              </Text>
              <View className="bg-gray-800 rounded-md p-2">
                {metadata?.creators && metadata.creators.length > 0 ? (
                  metadata.creators.map((c, i) => (
                    <View
                      key={i}
                      className="flex-row justify-between items-center mb-3 last:mb-0"
                    >
                      <Text className="text-white text-sm font-medium">
                        {c.address.slice(0, 4)}...{c.address.slice(-4)}{' '}
                        {c.share ? `(${c.share}%)` : ''}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleCopyMint(c.address)}
                      >
                        <CopyIcon width={16} height={16} />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text className="text-white text-sm font-medium">—</Text>
                )}
              </View>
            </View>

            {/* Royalty Section */}
            <View className="mb-4">
              <Text className="text-white text-base font-medium mb-2">
                Royalty
              </Text>
              <View className="bg-gray-800 rounded-md p-2">
                {metadata?.royalty ? (
                  <>
                    <View className="flex-row justify-between mb-3">
                      <Text className="text-gray-400 text-sm">
                        Royalty Model
                      </Text>
                      <Text className="text-white text-sm font-medium">
                        {metadata.royalty.royalty_model || '—'}
                      </Text>
                    </View>
                    <View className="flex-row justify-between mb-3">
                      <Text className="text-gray-400 text-sm">Percent</Text>
                      <Text className="text-white text-sm font-medium">
                        {metadata.royalty.percent
                          ? `${metadata.royalty.percent.toFixed(2) ?? 0}%`
                          : '—'}
                      </Text>
                    </View>
                    <View className="flex-row justify-between mb-3">
                      <Text className="text-gray-400 text-sm">
                        Basis Points
                      </Text>
                      <Text className="text-white text-sm font-medium">
                        {metadata.royalty.basis_points || '—'}
                      </Text>
                    </View>
                    <View className="flex-row justify-between mb-3">
                      <Text className="text-gray-400 text-sm">
                        Primary Sale Happened
                      </Text>
                      <Text className="text-white text-sm font-medium">
                        {metadata.royalty.primary_sale_happened
                          ? 'TRUE'
                          : 'FALSE'}
                      </Text>
                    </View>
                    <View className="flex-row justify-between mb-3 last:mb-0">
                      <Text className="text-gray-400 text-sm">Locked</Text>
                      <Text className="text-white text-sm font-medium">
                        {metadata.royalty.locked || 'FALSE'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text className="text-white text-sm font-medium">—</Text>
                )}
              </View>
            </View>

            {/* Mutable */}
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">Mutable</Text>
              <Text className="text-white text-sm font-medium">
                {metadata?.mutable ? 'TRUE' : 'FALSE'}
              </Text>
            </View>

            {/* JSON */}
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-400 text-sm">JSON</Text>
              <TouchableOpacity onPress={handleOpenJson}>
                <View className="flex-row items-center">
                  <OpenLink width={16} height={16} />
                </View>
              </TouchableOpacity>
            </View>

            {/* External Link */}
            <View className="flex-row justify-between">
              <Text className="text-gray-400 text-sm">External Link</Text>
              <TouchableOpacity onPress={handleOpenExternal}>
                <View className="flex-row items-center">
                  <OpenLink width={16} height={16} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

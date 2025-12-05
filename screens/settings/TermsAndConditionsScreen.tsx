import React, { JSX } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import BottomNavBar from '../../components/BottomNavBar';

/**
 * Terms & Conditions screen using NativeWind for styling only (className).
 * All text rendered in <View> and <Text> elements per user's request.
 *
 * Ensure NativeWind is configured in your project.
 */

export default function TermsAndConditionsScreen(): JSX.Element {
  const nav = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-[#000000]">
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View className="flex-row items-center px-4 mb-2 border-b border-[#111]">
        <View className="flex-1 items-center">
          <Text className="text-[#FFFFFF] text-lg font-extrabold">
            Terms & Conditions
          </Text>
          <Text className="text-[#CCCCCC] text-xs mt-1">
            Ping Pay — Version 1.0.2
          </Text>
        </View>
      </View>

      {/* Accent bar */}
      <View className="h-0.5 rounded-sm bg-[#9707B5]" />

      {/* Content */}
      <ScrollView className="flex-1">
        <View className="mx-1">
          {/* Card */}
          <View className="bg-[#070707] rounded-xl p-4 border border-[#1B0A1B] shadow-lg">
            {/* 1. Purpose & Acceptance */}
            <View>
              <Text className="text-[#9707B5] text-lg font-bold">
                1. Purpose & Acceptance
              </Text>
              <Text className="text-[#DDDDDD] text-sm mt-2">
                These Terms & Conditions (“Terms”) govern the use of the
                non-custodial wallet application “Ping Pay” (the “Service”)
                provided by the Company (“we,” “us,” or the “Company”). By
                installing, accessing, or using the Service, you (“you” or the
                “User”) are deemed to have accepted these Terms and our related
                policies (including the Privacy Policy).
              </Text>
            </View>

            {/* 2. Nature */}
            <View className="mt-4">
              <Text className="text-[#9707B5] text-lg font-bold">
                2. Nature of the Service (Non-Custodial Wallet)
              </Text>

              <View className="mt-2 space-y-3">
                <View className="flex-row">
                  <Text className="text-[#FFCC00] w-6 font-extrabold">1.</Text>
                  <Text className="text-[#DDDDDD] flex-1 text-sm">
                    Ping Pay does{' '}
                    <Text className="text-[#FFFFFF] font-extrabold">not</Text>{' '}
                    store, hold, or control your private keys/seed phrases and
                    does not have custody, management, or control over your
                    blockchain assets.
                  </Text>
                </View>

                <View className="flex-row">
                  <Text className="text-[#FFCC00] w-6 font-extrabold">2.</Text>
                  <Text className="text-[#DDDDDD] flex-1 text-sm">
                    All transactions are broadcast to blockchain networks solely
                    under your instruction and signature. We do not control or
                    guarantee any outcome (success/failure/delay).
                  </Text>
                </View>

                <View className="flex-row">
                  <Text className="text-[#FFCC00] w-6 font-extrabold">3.</Text>
                  <Text className="text-[#DDDDDD] flex-1 text-sm">
                    If you lose your private key/seed phrase,{' '}
                    <Text className="text-[#FFFFFF] font-extrabold">
                      recovery is impossible
                    </Text>
                    . All resulting losses are solely your responsibility.
                  </Text>
                </View>

                <View className="flex-row">
                  <Text className="text-[#FFCC00] w-6 font-extrabold">4.</Text>
                  <Text className="text-[#DDDDDD] flex-1 text-sm">
                    Your private key may be{' '}
                    <Text className="text-[#FFFFFF] font-extrabold">
                      stored on your device
                    </Text>
                    . Any key theft or loss due to external attacks (malware,
                    phishing, device loss, unauthorized access, etc.) and any
                    resulting losses are{' '}
                    <Text className="text-[#FFFFFF] font-extrabold">
                      entirely your responsibility
                    </Text>
                    .
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. Features */}
            <View className="mt-4">
              <Text className="text-[#9707B5] text-lg font-bold">
                3. Features
              </Text>
              <Text className="text-[#DDDDDD] text-sm mt-2">
                The Service may include:
              </Text>

              <View className="mt-2 space-y-2">
                <View className="flex-row items-start">
                  <View className="w-2 h-2 bg-[#9707B5] rounded-full mt-2 mr-3" />
                  <Text className="text-[#DDDDDD] text-sm flex-1">
                    <Text className="text-[#FFFFFF] font-bold">Swap:</Text>{' '}
                    Token exchange via third-party protocols/aggregators
                  </Text>
                </View>

                <View className="flex-row items-start">
                  <View className="w-2 h-2 bg-[#9707B5] rounded-full mt-2 mr-3" />
                  <Text className="text-[#DDDDDD] text-sm flex-1">
                    <Text className="text-[#FFFFFF] font-bold">Transfer:</Text>{' '}
                    Sending/receiving assets to/from blockchain addresses
                  </Text>
                </View>

                <View className="flex-row items-start">
                  <View className="w-2 h-2 bg-[#9707B5] rounded-full mt-2 mr-3" />
                  <Text className="text-[#DDDDDD] text-sm flex-1">
                    <Text className="text-[#FFFFFF] font-bold">
                      Claim Rewards:
                    </Text>{' '}
                    On-chain/off-chain reward functions (including
                    promotions/events)
                  </Text>
                </View>

                <View className="flex-row items-start">
                  <View className="w-2 h-2 bg-[#9707B5] rounded-full mt-2 mr-3" />
                  <Text className="text-[#DDDDDD] text-sm flex-1">
                    <Text className="text-[#FFFFFF] font-bold">
                      DApp Browser:
                    </Text>{' '}
                    Linking to external DApps/web pages
                  </Text>
                </View>
              </View>

              <Text className="text-[#DDDDDD] text-sm mt-3">
                Features may be added, changed, or discontinued depending on
                region, partners, or policy updates.
              </Text>
            </View>

            {/* 4. Eligibility */}
            <View className="mt-4">
              <Text className="text-[#9707B5] text-lg font-bold">
                4. Eligibility & Compliance
              </Text>

              <View className="mt-2 space-y-2">
                <View className="flex-row">
                  <Text className="text-[#FFCC00] w-6 font-extrabold">1.</Text>
                  <Text className="text-[#DDDDDD] flex-1 text-sm">
                    You must have the legal capacity and be of legal age to
                    accept these Terms and must comply with the laws of your
                    place of residence.
                  </Text>
                </View>

                <View className="flex-row">
                  <Text className="text-[#FFCC00] w-6 font-extrabold">2.</Text>
                  <Text className="text-[#DDDDDD] flex-1 text-sm">
                    Users in violation of sanctions, AML/CFT, or sanctions lists
                    (e.g., OFAC, UN) must not use the Service.
                  </Text>
                </View>

                <View className="flex-row">
                  <Text className="text-[#FFCC00] w-6 font-extrabold">3.</Text>
                  <Text className="text-[#DDDDDD] flex-1 text-sm">
                    We may restrict or suspend the Service if required by law or
                    regulation.
                  </Text>
                </View>
              </View>
            </View>

            {/* 5. Prohibited Conduct */}
            <View className="mt-4">
              <Text className="text-[#9707B5] text-lg font-bold">
                5. Prohibited Conduct
              </Text>
              <Text className="text-[#DDDDDD] text-sm mt-2">
                You must not engage in:
              </Text>

              <View className="mt-2 space-y-2">
                <View className="flex-row items-start">
                  <View className="w-2 h-2 rounded-full mt-2 mr-3 bg-[#E53935]" />
                  <Text className="text-[#DDDDDD] text-sm flex-1">
                    Illegal acts, fraud, money laundering, terrorist financing,
                    sanctions violations, IP or privacy infringement
                  </Text>
                </View>

                <View className="flex-row items-start">
                  <View className="w-2 h-2 rounded-full mt-2 mr-3 bg-[#E53935]" />
                  <Text className="text-[#DDDDDD] text-sm flex-1">
                    Hacking, exploiting vulnerabilities, abnormal traffic
                    generation, reverse engineering
                  </Text>
                </View>

                <View className="flex-row items-start">
                  <View className="w-2 h-2 rounded-full mt-2 mr-3 bg-[#E53935]" />
                  <Text className="text-[#DDDDDD] text-sm flex-1">
                    Impersonation, providing false information, system
                    circumvention,{' '}
                    <Text className="text-[#FFFFFF] font-extrabold">
                      attempting to obtain rewards fraudulently
                    </Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* 6 - 13 (condensed but full text entries as requested) */}
            <View className="mt-4 space-y-4">
              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  6. Third-Party Services & Links
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  1. Swap, pricing, rewards, and DApp features may be provided
                  or integrated by{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    third parties
                  </Text>
                  . We do not warrant their availability, accuracy, legality, or
                  quality.
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  2. Use of third-party services is subject to the
                  terms/policies of the respective providers, which you must
                  review and accept.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  7. Fees & Costs
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  1. Network fees (gas), third-party protocol fees, slippage,
                  and price fluctuations may apply and are{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    borne by you
                  </Text>
                  .
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  2. If we charge any Service fee, we will provide prior notice
                  in-app or via announcements.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  8. Rewards Program
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  1. Rewards may have conditions, methods, and rates that{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    change from time to time
                  </Text>
                  , and{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    are not guaranteed
                  </Text>
                  .
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  2. If we determine fraudulent use (bots, multiple accounts,
                  exploit attempts, etc.), we may withhold or claw back rewards
                  and limit access.
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  3. You are responsible for{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    all taxes/filings
                  </Text>{' '}
                  arising from rewards.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  9. Risk Disclosure (Important)
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  Using digital assets and blockchains involves significant
                  risks, including but not limited to:
                </Text>

                <View className="mt-2 space-y-2">
                  <View className="flex-row items-start">
                    <View className="w-2 h-2 rounded-full mt-1 mr-3 bg-[#FFCC00]" />
                    <Text className="text-[#DDDDDD] text-sm flex-1">
                      <Text className="text-[#FFFFFF] font-bold">
                        Market risk:
                      </Text>{' '}
                      price volatility, lack of liquidity, slippage
                    </Text>
                  </View>

                  <View className="flex-row items-start">
                    <View className="w-2 h-2 rounded-full mt-1 mr-3 bg-[#FFCC00]" />
                    <Text className="text-[#DDDDDD] text-sm flex-1">
                      <Text className="text-[#FFFFFF] font-bold">
                        Technology risk:
                      </Text>{' '}
                      network congestion, forks, bugs, smart-contract
                      vulnerabilities,{' '}
                      <Text className="text-[#FFFFFF] font-bold">
                        device security weaknesses
                      </Text>
                      , wallet loss/theft
                    </Text>
                  </View>

                  <View className="flex-row items-start">
                    <View className="w-2 h-2 rounded-full mt-1 mr-3 bg-[#FFCC00]" />
                    <Text className="text-[#DDDDDD] text-sm flex-1">
                      <Text className="text-[#FFFFFF] font-bold">
                        Regulatory risk:
                      </Text>{' '}
                      legal/policy changes and enforcement
                    </Text>
                  </View>

                  <View className="flex-row items-start">
                    <View className="w-2 h-2 rounded-full mt-1 mr-3 bg-[#FFCC00]" />
                    <Text className="text-[#DDDDDD] text-sm flex-1">
                      <Text className="text-[#FFFFFF] font-bold">
                        Counterparty risk:
                      </Text>{' '}
                      third-party service outages/errors/misconduct
                    </Text>
                  </View>
                </View>

                <Text className="text-[#DDDDDD] text-sm mt-3">
                  We are{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    not liable
                  </Text>{' '}
                  for any loss, delay, or error arising from such risks. Conduct
                  your own research (DYOR) and act at your own risk.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  10. Taxes & Reporting
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  You are solely responsible for all{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    taxes, fees, and filings
                  </Text>{' '}
                  related to your transactions, holdings, and rewards.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  11. Intellectual Property & License
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  1. Rights to the Service and its content (trademarks, logos,
                  UI, text, images, software, etc.) belong to the Company or
                  rightful owners.
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  2. We grant you a{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    non-exclusive, non-transferable, revocable, limited license
                  </Text>{' '}
                  to use the Service.
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  3. You may not reproduce, distribute, modify, or
                  reverse-engineer any part of the Service without express
                  permission.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  12. Disclaimer of Warranties (“As Is”)
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  The Service is provided{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">"as is"</Text>{' '}
                  without express or implied warranties of any kind. We do not
                  warrant error-free, uninterrupted, secure operation,
                  suitability, or fitness for a particular purpose, and we do
                  not accept liability for data loss, transmission failures, or
                  delays.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  13. Limitation of Liability
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  To the extent permitted by law, we are not liable for (i)
                  indirect, incidental, special, or punitive damages; (ii) loss
                  of profits, revenue, data, or goodwill; or (iii) damages
                  arising from third-party services.
                </Text>
              </View>
            </View>

            {/* 14 - 20 */}
            <View className="mt-4 space-y-4">
              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  14. Indemnification (Plain-Language Explanation)
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  If your{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    breach of these Terms
                  </Text>{' '}
                  or your{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    improper use
                  </Text>{' '}
                  of the Service causes a third party to bring a claim, dispute,
                  or demand against the Company, you agree to{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    protect and support the Company
                  </Text>{' '}
                  (including its officers, employees, affiliates, and partners).
                </Text>

                <View className="mt-2 space-y-2">
                  <View className="flex-row items-start">
                    <View className="w-2 h-2 rounded-full mt-1 mr-3 bg-[#FFCC00]" />
                    <Text className="text-[#DDDDDD] text-sm flex-1">
                      Reimburse{' '}
                      <Text className="text-[#FFFFFF] font-extrabold">
                        reasonable costs
                      </Text>{' '}
                      arising from such claims (e.g., legal fees)
                    </Text>
                  </View>

                  <View className="flex-row items-start">
                    <View className="w-2 h-2 rounded-full mt-1 mr-3 bg-[#FFCC00]" />
                    <Text className="text-[#DDDDDD] text-sm flex-1">
                      Cooperate by providing information and assistance for
                      defense and resolution
                    </Text>
                  </View>

                  <View className="flex-row items-start">
                    <View className="w-2 h-2 rounded-full mt-1 mr-3 bg-[#FFCC00]" />
                    <Text className="text-[#DDDDDD] text-sm flex-1">
                      Take reasonable steps to prevent recurrence
                    </Text>
                  </View>
                </View>

                <Text className="text-[#DDDDDD] text-sm mt-3">
                  <Text className="text-[#FFFFFF] font-extrabold">
                    Exception:
                  </Text>{' '}
                  This indemnification does{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">not</Text>{' '}
                  apply to the extent a loss is caused by the Company’s{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    willful misconduct or gross negligence
                  </Text>
                  .
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  15. Changes & Suspension
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  1. We may modify or suspend the Terms or the Service for legal
                  or operational reasons. Material changes will be announced in
                  advance.
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  2. Continuing to use the Service after changes take effect
                  constitutes acceptance of the updated Terms.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  16. Access Restrictions
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  We may restrict or discontinue access{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    without prior notice
                  </Text>{' '}
                  if you violate the Terms or laws. If criminal activity is
                  suspected, we may notify relevant authorities.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  17. Termination
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  You may stop using the Service at any time. Responsibilities
                  arising from on-chain transactions and third-party usage will
                  continue to apply.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  18. Consumer Rights
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  The Service is{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    provided free of charge
                  </Text>
                  . Certain consumer-protection rules that presuppose paid
                  transactions may{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">not</Text>{' '}
                  apply. However,{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">
                    non-waivable statutory rights
                  </Text>
                  , if any, are{' '}
                  <Text className="text-[#FFFFFF] font-extrabold">not</Text>{' '}
                  limited by these Terms.
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  19. Contact
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  Business inquiries:{' '}
                  <Text className="text-[#FFCC00] underline">
                    business@meccain.com
                  </Text>
                </Text>
              </View>

              <View>
                <Text className="text-[#9707B5] text-lg font-bold">
                  20. Miscellaneous
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-2">
                  1. If any provision of these Terms is held invalid or
                  unenforceable, the remaining provisions remain in full force
                  and effect.
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  2. Failure to exercise a right is not a waiver of that right.
                </Text>
                <Text className="text-[#DDDDDD] text-sm mt-1">
                  3. You may not assign or transfer any rights or obligations
                  under these Terms without our prior written consent.
                </Text>
              </View>
            </View>

            {/* Alert box */}
            <View className="mt-6 p-3 rounded-lg border border-[#9707B5] bg-[#1B0A1B]">
              <Text className="text-[#FFCC00] font-extrabold">Important</Text>
              <Text className="text-[#FFEFCF] text-sm mt-2">
                This is a non-custodial wallet. If you lose your seed phrase,
                recovery is not possible. Keep your credentials safe.
              </Text>
            </View>

            {/* Footer actions */}
            <View className="mt-6 flex-row justify-between">
              <TouchableOpacity
                onPress={() => {
                  // @ts-ignore
                  nav.navigate('Home');
                }}
                className="border border-[#222] px-4 py-3 rounded-lg min-w-[120px] items-center"
              >
                <Text className="text-[#CCCCCC] font-semibold">Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  // @ts-ignore
                  nav.navigate('Home');
                }}
                className="bg-[#9707B5] px-4 py-3 rounded-lg min-w-[140px] items-center"
              >
                <Text className="text-[#FFFFFF] font-extrabold">
                  I Understand
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNavBar active="null" />
    </SafeAreaView>
  );
}

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
import { ResetChoicePicker } from '@/components/ResetChoicePicker';
import { selectResetChoices } from '@/lib/challenge-capability';
import { getEarnedResetChoices } from '@/lib/earned-reset-templates';
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('lucide-react-native',()=>({Waves:()=>null,Search:()=>null,Activity:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
const no={available:false,permission:'unavailable' as const,canAskAgain:false};
const choices=selectResetChoices({premium:false,hour:12,mood:'steady',attemptsToday:0,streakDays:0},{photo:no,motion:no,steps:no,location:no,connection:no});
test('three accessible category actions select their actual activity rather than a decorative tile',()=>{
 const selected:string[]=[];
 const screen=render(<I18nextProvider i18n={appI18n}><ResetChoicePicker choices={choices} onChoose={item=>selected.push(item.id)} /></I18nextProvider>);
 fireEvent.press(screen.getByRole('button',{name:/^Breathe/}));
 fireEvent.press(screen.getByRole('button',{name:/^Find something/}));
 fireEvent.press(screen.getByRole('button',{name:/^Move/}));
 expect(selected).toEqual(choices.map(choice=>choice.challenge.id));
});
test('an unavailable choice list displays loading without actionable fake activities',()=>{
 const screen=render(<I18nextProvider i18n={appI18n}><ResetChoicePicker choices={[]} onChoose={()=>{throw Error('No choice');}} /></I18nextProvider>);
 expect(screen.getByText('Checking available resets…')).toBeTruthy();
 expect(screen.queryAllByRole('button')).toHaveLength(0);
});

test('optional native-reward caption is visible and announced before the actual choice',()=>{
 const screen=render(<I18nextProvider i18n={appI18n}><ResetChoicePicker choices={choices} onChoose={()=>{}} rewardLabel={challenge=>challenge.choiceGroup==='breathe'?'2 min app break on request':challenge.choiceGroup==='move'?'5 min app break on request':null} /></I18nextProvider>);
 expect(screen.getByTestId('reset-reward-breathe')).toBeTruthy();
 expect(screen.getByTestId('reset-reward-move')).toBeTruthy();
 expect(screen.queryByTestId('reset-reward-find')).toBeNull();
 expect(screen.getByRole('button',{name:/^Breathe.*2 min app break/})).toBeTruthy();
});
test('native step alternative is separately actionable and describes count rather than fabricated timer completion',()=>{
 const offer:any={offerId:'32345678-1234-4123-8123-123456789abc',nativeInterventionId:'12345678-1234-4123-8123-123456789abc',groupId:'group',groupRevision:1,configurationGeneration:1,scopeEpoch:1,kind:'ios-app-group',requestedSeconds:300,budgetDay:'2026-10-11',budgetRevision:0,validUntil:'2026-10-11T12:00:00Z',requiredActiveSeconds:60,requiredSteps:30,requiredDistinctPhotoTargets:1,availableMethods:['timer','steps']};
 const selected:string[]=[];const screen=render(<I18nextProvider i18n={appI18n}><ResetChoicePicker choices={getEarnedResetChoices(offer)} onChoose={challenge=>selected.push(challenge.id)}/></I18nextProvider>);
 expect(screen.getByText('30 observed steps')).toBeTruthy();
 fireEvent.press(screen.getByTestId('reset-choice-move-steps'));
 expect(selected).toEqual(['momentum-move-steps:earned-v2:300']);
});

test('earned Move alternatives share one category and keep their exact factory objects; Find stays non-actionable',()=>{
 const offer:any={offerId:'32345678-1234-4123-8123-123456789abc',nativeInterventionId:'12345678-1234-4123-8123-123456789abc',groupId:'group',groupRevision:1,configurationGeneration:1,scopeEpoch:1,kind:'ios-app-group',requestedSeconds:600,budgetDay:'2026-10-11',budgetRevision:0,validUntil:'2026-10-11T12:00:00Z',requiredActiveSeconds:120,requiredSteps:60,requiredDistinctPhotoTargets:2,availableMethods:['timer','steps']};
 const available=getEarnedResetChoices(offer),selected=jest.fn();
 const screen=render(<I18nextProvider i18n={appI18n}><ResetChoicePicker choices={available} onChoose={selected} showUnavailableFind /></I18nextProvider>);
 expect(screen.getAllByTestId('reset-category-move')).toHaveLength(1);
 expect(screen.getByTestId('reset-find-unavailable')).toHaveTextContent(/Photo matching is unavailable/);
 expect(screen.queryByTestId('reset-choice-find')).toBeNull();
 fireEvent.press(screen.getByTestId('reset-choice-move'));expect(selected).toHaveBeenLastCalledWith(available.find(item=>item.group==='move')!.challenge);
 fireEvent.press(screen.getByTestId('reset-choice-move-steps'));expect(selected.mock.calls[1][0]).toBe(available.find(item=>item.challenge.verification?.kind==='steps')!.challenge);
 expect(screen.getAllByRole('button')).toHaveLength(3);
 expect(screen.getByTestId('reset-choice-move').props.accessibilityLabel).toContain('movement self-reported');
});

test('photo choices name actual local targets before the action and decorative art creates no button',()=>{
 const offer:any={offerId:'32345678-1234-4123-8123-123456789abc',nativeInterventionId:'12345678-1234-4123-8123-123456789abc',groupId:'group',groupRevision:1,configurationGeneration:1,scopeEpoch:1,kind:'ios-app-group',requestedSeconds:600,budgetDay:'2026-10-11',budgetRevision:0,validUntil:'2026-10-11T12:00:00Z',requiredActiveSeconds:120,requiredSteps:60,requiredDistinctPhotoTargets:2,availableMethods:['photo'],supportedPhotoTargetIds:['chair','cup']};
 const selected=jest.fn(),available=getEarnedResetChoices(offer);
 const screen=render(<I18nextProvider i18n={appI18n}><ResetChoicePicker choices={available} onChoose={selected} /></I18nextProvider>);
 expect(screen.getByRole('button').props.accessibilityLabel).toContain('chair, cup');
 expect(screen.getAllByRole('button')).toHaveLength(1);fireEvent.press(screen.getByRole('button'));expect(selected.mock.calls[0][0]).toBe(available[0].challenge);
});

import React from 'react';
import {render,fireEvent,waitFor} from '@testing-library/react-native';
import {ProtectionReactivation} from '@/components/ProtectionReactivation';
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'}),useOptionalAppPreferences:()=>null}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
test('a post-deletion setup never activates on mount, retry/refresh or navigation',async()=>{
 const resume=jest.fn().mockRejectedValue(new Error('rejected')),close=jest.fn();const view=render(<ProtectionReactivation onResume={resume} onClose={close}/>);expect(resume).not.toHaveBeenCalled();fireEvent.press(view.getByTestId('protection-resume'));await waitFor(()=>expect(view.getByRole('alert')).toBeTruthy());expect(resume).toHaveBeenCalledTimes(1);fireEvent.press(view.getByTestId('protection-resume-close'));expect(close).toHaveBeenCalledTimes(1);expect(resume).toHaveBeenCalledTimes(1);
});

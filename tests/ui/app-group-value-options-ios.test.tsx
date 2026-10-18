import React from 'react';
import {render,fireEvent} from '@testing-library/react-native';
import {AppGroupValueOptions} from '@/components/AppGroupValueOptions.ios';
import {appI18n} from '@/i18n/runtime';
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'dark'})}));
test('iOS duration wheel uses numeric duration tags, preserves current values and rejects unknown selections',()=>{
 const onChange=jest.fn();const view=render(<AppGroupValueOptions label="Daily allowance" value={37} options={[{value:30,label:'30 min',testID:'30'},{value:37,label:'37 min',testID:'37'},{value:45,label:'45 min',testID:'45'}]} onChange={onChange}/>);const picker=view.getByTestId('mock-native-preference-picker');
 expect(picker.props.selection).toBe(37);expect(picker.props.modifiers).toContainEqual({type:'pickerStyle',value:'wheel'});expect(view.getByText('37 min').props.modifiers).toContainEqual({type:'tag',value:37});fireEvent(picker,'selectionChange',45);expect(onChange).toHaveBeenCalledWith(45);fireEvent(picker,'selectionChange',999);expect(onChange).toHaveBeenCalledTimes(1);
});
test.each(['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'])('compact editor flow has authored %s duration/cap semantics',async language=>{
 await appI18n.changeLanguage(language);const copy=appI18n.t('appEditor.dailyFlow',{dailyMinutes:30,breakMinutes:20});expect(copy).not.toContain('appEditor.');expect(copy).toContain(language==='ar'?'٣٠':'30');expect(copy).toContain(language==='ar'?'٢٠':'20');expect(copy).not.toContain('{{');if(language!=='en')expect(copy).not.toContain('without a challenge');await appI18n.changeLanguage('en');
});

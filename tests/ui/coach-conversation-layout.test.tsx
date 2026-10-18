import React from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { CoachConversationLayout } from '@/components/CoachConversationLayout';
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
test('the editable composer stays outside the scrolling transcript and remains reachable with long conversations',()=>{
 const edits:string[]=[];
 const view=render(<CoachConversationLayout composer={<TextInput testID="message" value="My draft" onChangeText={text=>edits.push(text)} />}><Text>{'A long conversation. '.repeat(200)}</Text></CoachConversationLayout>);
 const transcript=view.getByTestId('coach-transcript');
 expect(transcript.findAllByProps({testID:'message'})).toHaveLength(0);
 expect(view.getByTestId('coach-composer')).toBeOnTheScreen();
 fireEvent.changeText(view.getByTestId('message'),'My next thought');
 expect(edits).toEqual(['My next thought']);
});

import { Redirect } from 'expo-router';

/**
 * v1.17 placeholder route for the bottom bar's centre YouMart AI button. The button opens the
 * assistant on top (/help/assistant) and never selects this tab; if it is ever reached, forward.
 */
export default function AiTab() {
  return <Redirect href="/help/assistant" />;
}

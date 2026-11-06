import { Redirect } from 'expo-router';

/**
 * v1.17 placeholder route for the bottom bar's centre button. The button opens Ask on top (v1.18:
 * /ask - YouMart AI and Product Finder Live) and never selects this tab; if it is reached, forward.
 */
export default function AiTab() {
  return <Redirect href="/ask" />;
}

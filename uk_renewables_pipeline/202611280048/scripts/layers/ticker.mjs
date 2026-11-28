import {latestHeadlines} from './model.mjs';
import {createTickerRenderer} from '../../../../automation/ticker_neon_ui/20261117-v940/ticker.mjs';
export const renderTicker=createTickerRenderer(latestHeadlines);

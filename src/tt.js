import * as cheerio from 'cheerio';
import axios from 'axios';

export async function getTtStreamUrl(channel) {
  const liveRoomInfo = await getLiveRoomDetails(channel);

  if (!liveRoomInfo) {
    return null;
  }

  const streams = parseStreams(liveRoomInfo.streamData);

  return findBestStreamQualityUrl(streams);
}

// <script id="SIGI_STATE" type="application/json"></script>
const DEFAULT_HEADERS = {
	// Connection: 'keep-alive',
	// 'Cache-Control': 'max-age=0',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
	// Accept: 'text/html,application/json,application/protobuf',
	// Referer: 'https://www.tiktok.com/',
	// Origin: 'https://www.tiktok.com',
	// 'Accept-Language': 'en-US,en;q=0.9',
	// 'Accept-Encoding': 'gzip, deflate',
};
const URL_WEB_LIVE = "https://www.tiktok.com/@{channel}/live";
// const STATUS_OFFLINE = 4;
const STATUSES = {
  LIVE: 2,
};

// 0 - Error or Inactive stream.
// 1 - Stream Starting or Preparing (the stream is not yet live but in the setup phase).
// 2 - Live
// 3 - Temporarily Suspended (for streams interrupted, often due to network issues).
// 4 - Offline
// 5 - Ended (Something like terminated or due to technical issues)
// 6 - Banned or Restricted (usually the result of violations during the stream, leading to a ban).

// Function to get live room details based on room ID
async function getLiveRoomDetails(channel) {
  try {
    const liveUrl = URL_WEB_LIVE.replace("{channel}", channel);
    const response = await axios.get(liveUrl, {
			headers: DEFAULT_HEADERS,
		});
    const pageHtml = response?.data;

    if (!pageHtml) {
      console.error('Empty body:', response);
      return;
    }

		const $ = cheerio.load(pageHtml);
		const sigiState = JSON.parse($('#SIGI_STATE')?.html());
    const ttUser = sigiState?.LiveRoom?.liveRoomUserInfo?.user;
    const roomId = sigiState?.LiveRoom?.liveRoomUserInfo?.user?.roomId;
    const liveRoomInfo = sigiState?.LiveRoom?.liveRoomUserInfo?.liveRoom;

    if (liveRoomInfo.status !== STATUSES.LIVE) {
      return null;
    }

    return liveRoomInfo;
  } catch (error) {
    console.error("Error fetching live room details:", error);
    return null;
  }
}

function parseStreams(streamData) {
  const { stream_data } = streamData?.pull_data;

  return JSON.parse(stream_data)?.data;
}

function findBestStreamQualityUrl(streams, type = 'flv') {
  return streams?.origin?.main?.[type];
}

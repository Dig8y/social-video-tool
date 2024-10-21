import axios from "axios";
import fs from "fs";
import Bluebird from "bluebird";
import dotenv from "dotenv";
dotenv.config();

const getPosts = async ({
  username,
  maxResults,
  withVideos = false,
}: {
  username: string;
  maxResults: number;
  withVideos: boolean;
}) => {
  if (!process.env.APIFY_API_KEY) {
    throw new Error("APIFY_API_KEY is not set in the environment variables");
  }

  const data = {
    excludePinnedPosts: false,
    profiles: [username],
    resultsPerPage: maxResults,
    shouldDownloadCovers: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadSubtitles: false,
    shouldDownloadVideos: withVideos,
    searchSection: "",
    maxProfilesPerQuery: 1,
  };

  const headers = {
    headers: {
      Authorization: `Bearer ${process.env.APIFY_API_KEY}`,
    },
  };

  try {
    const response = await axios.post(
      `https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items`,
      data,
      headers
    );

    if (response.status !== 201) {
      throw new Error("Failed to fetch posts");
    }

    console.log("RETURNED DATA", response.data, response.status);

    const returnedPosts = response.data;

    const cleanedPosts: CleanedPost[] = returnedPosts.map(
      (post: TikTokPost) => ({
        id: post.id,
        timestamp: post.createTime,
        postUrl: post.webVideoUrl,
        videoUrl: post?.videoMeta?.downloadAddr ?? "",
        audioUrl: post.musicMeta.playUrl,
        caption: post.text,
        hashtags: post.hashtags,
        isPinned: post.isPinned,
        isSponsored: post.isSponsored,
      })
    );

    console.log(cleanedPosts);

    return cleanedPosts;
  } catch (error) {
    console.error("Error fetching posts:", error);
    throw error;
  }
};

const downloadTTPosts = async ({
  username,
  posts,
  withVideos,
}: {
  username: string;
  posts: CleanedPost[];
  withVideos: boolean;
}) => {
  const folderName = `${username}_tt_media`;

  const audioFolderName = `${folderName}/audios`;

  if (!fs.existsSync(audioFolderName)) {
    await fs.promises.mkdir(audioFolderName, { recursive: true });
  }

  const videoFolderName = `${folderName}/videos`;

  if (!fs.existsSync(videoFolderName)) {
    await fs.promises.mkdir(videoFolderName, { recursive: true });
  }

  await Bluebird.map(
    posts,
    async (post) => {
      try {
        if (post.audioUrl) {
          const response = await axios.get(post.audioUrl, {
            responseType: "arraybuffer",
          });
          const buffer = Buffer.from(response.data, "binary");
          const fileName = `${audioFolderName}/tt_${username}_${post.id}_audio.mp3`;
          console.log(`Saving ${fileName}`);
          await fs.promises.writeFile(fileName, buffer);
        }

        if (withVideos && post.videoUrl) {
          const response = await axios.get(post.videoUrl, {
            responseType: "arraybuffer",
          });
          const buffer = Buffer.from(response.data, "binary");
          const fileName = `${videoFolderName}/tt_${username}_${post.id}_video.mp4`;
          console.log(`Saving ${fileName}`);
          await fs.promises.writeFile(fileName, buffer);
        }
      } catch (error) {
        console.error(`Error downloading video for post ${post.id}:`, error);
      }
    },
    { concurrency: 2 }
  );
};

(async () => {
  const username = "willcaplan_changemakers";
  console.log("fetching profile data for...", username);
  const withVideos = false;
  const maxResults = 200;
  try {
    const posts = await getPosts({ username, maxResults, withVideos });
    fs.writeFileSync(
      `tt_${username}_posts.json`,
      JSON.stringify(posts, null, 2)
    );

    await downloadTTPosts({ username, posts, withVideos });
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();

interface TikTokPost {
  id: string;
  text: string;
  createTime: number;
  createTimeISO: string;
  authorMeta: {
    id: string;
    name: string;
    profileUrl: string;
    nickName: string;
    verified: boolean;
    signature: string;
    bioLink: string | null;
    avatar: string;
    commerceUserInfo: object;
    privateAccount: boolean;
    region: string;
    roomId: string;
    ttSeller: boolean;
    following: number;
    friends: number;
    fans: number;
    heart: number;
    video: number;
    digg: number;
  };
  musicMeta: {
    musicName: string;
    musicAuthor: string;
    musicOriginal: boolean;
    playUrl: string;
    coverMediumUrl: string;
    musicId: string;
  };
  webVideoUrl: string;
  mediaUrls: string[];
  videoMeta?: {
    height: number;
    width: number;
    duration: number;
    coverUrl: string;
    originalCoverUrl: string;
    definition: string;
    format: string;
    subtitleLinks: any[];
    downloadAddr: string;
  };
  diggCount: number;
  shareCount: number;
  playCount: number;
  collectCount: number;
  commentCount: number;
  mentions: any[];
  hashtags: object[];
  effectStickers: any[];
  isSlideshow: boolean;
  isPinned: boolean;
  isSponsored: boolean;
  input: string;
}

interface CleanedPost {
  id: string;
  timestamp: number;
  postUrl: string;
  videoUrl?: string;
  audioUrl: string;
  caption: string;
  hashtags: object[];
  isPinned: boolean;
  isSponsored: boolean;
}

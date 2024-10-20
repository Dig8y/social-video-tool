import axios from "axios";
import fs from "fs";
import Bluebird from "bluebird";
import dotenv from "dotenv";
dotenv.config();

const getPosts = async ({
  username,
  resultsLimit = 200,
}: {
  username: string;
  resultsLimit?: number;
}) => {
  if (!process.env.APIFY_API_KEY) {
    throw new Error("APIFY_API_KEY is not set in the environment variables");
  }

  const data = {
    username: [username],
    resultsLimit,
  };

  const headers = {
    headers: {
      Authorization: `Bearer ${process.env.APIFY_API_KEY}`,
    },
  };

  try {
    const response = await axios.post(
      `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items`,
      data,
      headers
    );
    if (response.status !== 201) {
      throw new Error("Failed to fetch posts");
    }

    const posts: CleanedInstagramPost[] = response.data.map(
      (post: InstagramPost) => ({
        id: post.id,
        shortCode: post.shortCode,
        timestamp: post.timestamp,
        url: post.url,
        videoUrl: post.videoUrl,
        caption: post.caption,
        hashtags: post.hashtags,
        displayUrl: post.displayUrl,
        likesCount: post.likesCount,
      })
    );
    console.log(posts);

    return posts;
  } catch (error) {
    console.error("Error fetching posts:", error);
    throw error;
  }
};

const downloadIGPosts = async ({
  username,
  posts,
}: {
  username: string;
  posts: CleanedInstagramPost[];
}) => {
  const folderName = `${username}_ig_videos`;

  // Create the directory if it doesn't exist
  if (!fs.existsSync(folderName)) {
    await fs.promises.mkdir(folderName);
  }

  await Bluebird.map(
    posts,
    async (post) => {
      try {
        const response = await axios.get(post.videoUrl, {
          responseType: "arraybuffer",
        });
        const buffer = Buffer.from(response.data, "binary");
        const fileName = `${folderName}/ig_${username}_${post.shortCode}.mp4`;
        console.log(`Saving ${fileName}`);
        await fs.promises.writeFile(fileName, buffer);
      } catch (error) {
        console.error(
          `Error downloading video for post ${post.shortCode}:`,
          error
        );
      }
    },
    { concurrency: 2 }
  );
};

(async () => {
  const username = "oliviacaplandesign";
  console.log("fetching profile data for...", username);

  const resultsLimit = 200;

  try {
    const posts = await getPosts({ username, resultsLimit });
    fs.writeFileSync(
      `ig_${username}_posts.json`,
      JSON.stringify(posts, null, 2)
    );

    console.log(`Fetched ${posts.length} posts for ${username}`);

    console.log("downloading videos...");

    await downloadIGPosts({ username, posts });
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();

interface InstagramPost {
  inputUrl: string;
  id: string;
  type: string;
  shortCode: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  url: string;
  commentsCount: number;
  firstComment: string;
  latestComments: string[];
  dimensionsHeight: number;
  dimensionsWidth: number;
  displayUrl: string;
  images: string[];
  videoUrl: string;
  alt: string | null;
  likesCount: number;
  videoViewCount: number;
  videoPlayCount: number;
  timestamp: string;
  childPosts: any[]; // Replace `any` with a more specific type if known
  ownerFullName: string;
  ownerUsername: string;
  ownerId: string;
  productType: string;
  videoDuration: number;
  isSponsored: boolean;
  taggedUsers: string[]; // Replace with a more specific type if known
  musicInfo: object; // Replace `object` with a more specific type if known
}

interface CleanedInstagramPost {
  id: string;
  shortCode: string;
  timestamp: string;
  url: string;
  videoUrl: string;
  caption: string;
  hashtags: string[];
  displayUrl: string;
  likesCount: number;
}

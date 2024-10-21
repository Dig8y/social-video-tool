import os
import requests
import json
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv()

def get_posts(username,  maxResults, with_videos=False):
    if not os.getenv('APIFY_API_KEY'):
        raise Exception("APIFY_API_KEY is not set in the environment variables")

    data = {
        "excludePinnedPosts": False,
        "profiles": [username],
        "resultsPerPage": maxResults,
        "shouldDownloadCovers": False,
        "shouldDownloadSlideshowImages": False,
        "shouldDownloadSubtitles": False,
        "shouldDownloadVideos": with_videos,
        "searchSection": "",
        "maxProfilesPerQuery": 1,
    }

    headers = {
        "Authorization": f"Bearer {os.getenv('APIFY_API_KEY')}"
    }

    try:
        response = requests.post(
            "https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items",
            json=data,
            headers=headers
        )

        if response.status_code != 201:
            raise Exception("Failed to fetch posts")

        print("RETURNED DATA", response.json(), response.status_code)

        returned_posts = response.json()

        cleaned_posts = [
            {
                "id": post["id"],
                "timestamp": post["createTime"],
                "postUrl": post["webVideoUrl"],
                "videoUrl": post.get("videoMeta", {}).get("downloadAddr", ""),
                "audioUrl": post["musicMeta"]["playUrl"],
                "caption": post["text"],
                "hashtags": post["hashtags"],
                "isPinned": post["isPinned"],
                "isSponsored": post["isSponsored"],
            }
            for post in returned_posts
        ]

        print(cleaned_posts)

        return cleaned_posts
    except Exception as error:
        print("Error fetching posts:", error)
        raise

def download_tt_posts(username, posts, with_videos):
    folder_name = f"{username}_tt_media"
    audio_folder_name = os.path.join(folder_name, "audios")
    video_folder_name = os.path.join(folder_name, "videos")

    os.makedirs(audio_folder_name, exist_ok=True)
    os.makedirs(video_folder_name, exist_ok=True)

    def download_post(post):
        try:
            if post["audioUrl"]:
                response = requests.get(post["audioUrl"])
                file_name = os.path.join(audio_folder_name, f"tt_{username}_{post['id']}_audio.mp3")
                print(f"Saving {file_name}")
                with open(file_name, 'wb') as f:
                    f.write(response.content)

            if with_videos and post["videoUrl"]:
                response = requests.get(post["videoUrl"])
                file_name = os.path.join(video_folder_name, f"tt_{username}_{post['id']}_video.mp4")
                print(f"Saving {file_name}")
                with open(file_name, 'wb') as f:
                    f.write(response.content)
        except Exception as error:
            print(f"Error downloading video for post {post['id']}:", error)

    with ThreadPoolExecutor(max_workers=2) as executor:
        executor.map(download_post, posts)

if __name__ == "__main__":
    username = "willcaplan_changemakers"
    print("fetching profile data for...", username)
    with_videos = False
    maxResults = 2
    try:
        posts = get_posts(username, maxResults, with_videos)
        with open(f"tt_{username}_posts.json", 'w') as f:
            json.dump(posts, f, indent=2)

        download_tt_posts(username, posts, with_videos)
    except Exception as error:
        print("An error occurred:", error)
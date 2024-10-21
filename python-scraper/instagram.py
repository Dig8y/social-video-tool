import os
import json
import requests
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv()

def get_posts(username, results_limit=200):
    if not os.getenv("APIFY_API_KEY"):
        raise ValueError("APIFY_API_KEY is not set in the environment variables")

    data = {
        "username": [username],
        "resultsLimit": results_limit,
    }

    headers = {
        "Authorization": f"Bearer {os.getenv('APIFY_API_KEY')}",
    }

    response = requests.post(
        "https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items",
        json=data,
        headers=headers
    )

    if response.status_code != 201:
        raise Exception("Failed to fetch posts")

    posts = [
        {
            "id": post["id"],
            "shortCode": post["shortCode"],
            "timestamp": post["timestamp"],
            "url": post["url"],
            "videoUrl": post["videoUrl"],
            "caption": post["caption"],
            "hashtags": post["hashtags"],
            "displayUrl": post["displayUrl"],
            "likesCount": post["likesCount"],
        }
        for post in response.json()
    ]

    print(posts)
    return posts

def download_ig_posts(username, posts):
    folder_name = f"{username}_ig_videos"

    if not os.path.exists(folder_name):
        os.makedirs(folder_name)

    def download_post(post):
        try:
            response = requests.get(post["videoUrl"], stream=True)
            file_name = f"{folder_name}/ig_{username}_{post['shortCode']}.mp4"
            print(f"Saving {file_name}")
            with open(file_name, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
        except Exception as e:
            print(f"Error downloading video for post {post['shortCode']}: {e}")

    with ThreadPoolExecutor(max_workers=2) as executor:
        executor.map(download_post, posts)

if __name__ == "__main__":
    username = "oliviacaplandesign"
    print(f"fetching profile data for... {username}")

    results_limit = 200

    try:
        posts = get_posts(username, results_limit)
        with open(f"ig_{username}_posts.json", "w") as f:
            json.dump(posts, f, indent=2)

        print(f"Fetched {len(posts)} posts for {username}")
        print("downloading videos...")

        download_ig_posts(username, posts)
    except Exception as e:
        print(f"An error occurred: {e}")
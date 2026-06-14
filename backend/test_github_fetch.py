import sys
sys.path.append(".")

from app.api.router import parse_github_url

def test_parse_github_url():
    print("Running parse_github_url tests...")
    
    # Test 1: simple repo name
    owner, repo, branch, path = parse_github_url("octocat/Hello-World")
    assert owner == "octocat"
    assert repo == "Hello-World"
    assert branch is None
    assert path is None
    print("[Pass] Test 1: simple repo name")
    
    # Test 2: HTTPS repo URL with .git
    owner, repo, branch, path = parse_github_url("https://github.com/octocat/Hello-World.git")
    assert owner == "octocat"
    assert repo == "Hello-World"
    assert branch is None
    assert path is None
    print("[Pass] Test 2: HTTPS repo URL with .git")
    
    # Test 3: HTTP repo URL with .git and trailing slash
    owner, repo, branch, path = parse_github_url("http://github.com/octocat/Hello-World.git/")
    assert owner == "octocat"
    assert repo == "Hello-World"
    assert branch is None
    assert path is None
    print("[Pass] Test 3: HTTP repo URL with .git and trailing slash")
    
    # Test 4: full file blob URL
    owner, repo, branch, path = parse_github_url("https://github.com/octocat/Hello-World/blob/master/src/index.js")
    assert owner == "octocat"
    assert repo == "Hello-World"
    assert branch == "master"
    assert path == "src/index.js"
    print("[Pass] Test 4: full file blob URL")
    
    # Test 5: raw file URL
    owner, repo, branch, path = parse_github_url("github.com/octocat/Hello-World/raw/main/README.md")
    assert owner == "octocat"
    assert repo == "Hello-World"
    assert branch == "main"
    assert path == "README.md"
    print("[Pass] Test 5: raw file URL")

if __name__ == "__main__":
    test_parse_github_url()
    print("All parse_github_url tests passed!")

This is the source for the website code currently deployed at 

http://home.apache.org/index.html
and
http://home.apache.org/phonebook.html

For local testing using Docker:

Change to 'home' checkout directory

$ docker compose build
$ docker compose run --rm home
This should leave you in a shell in the container

To fetch the JSON files:
# tools/update_json.sh

To create the committer listings:
# python3 tools/committers.py

To download the keys:
# lua tools/pgp.lua --no-refresh
Note that refresh takes a long time, so it is only run once a week
The --no-refresh flag skips the refresh entirely

This is the source for the website code currently deployed at 

http://home.apache.org/index.html
and
http://home.apache.org/phonebook.html

For local testing using Docker:

Change to 'home' checkout directory

Build the image (only needs to be done once, or when Dockerfile or compose.yaml are changed)
$ docker compose build

Start the webserver - available on localhost:1080
$ docker compose up

Press ^C and wait to shut the server down

While it is running, you can start a shell in the container
$ docker compose exec home /bin/bash
This should leave you in a shell in the container which is running the webserver

Alternatively, if you just want to run commands without the server:
$ docker compose run --rm home /bin/bash
This will start a standalone container.

Note that the home directory (/var/www) in the container is mapped to
the launch directory on the host, so all containers started from the same directory
share files.

Commands to run in the container:

To fetch the JSON files:
# tools/update_json.sh

To create the committer listings:
# python3 tools/committers.py

To download the keys:
# lua tools/pgp.lua --no-refresh
Note that refresh takes a long time, so it is only run once a week
The --no-refresh flag skips the refresh entirely

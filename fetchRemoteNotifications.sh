#!/bin/sh
rsync -r -a -v -e ssh root@91.134.141.206:/mnt/vdb/opteameo/data/notifications ~/Sites/opteameo/afp-web-foot/dist/data/
rsync -r -a -v -e ssh root@91.134.141.206:/mnt/vdb/opteameo/data/comments ~/Sites/opteameo/afp-web-foot/dist/data/
rsync -r -a -v -e ssh root@91.134.141.206:/mnt/vdb/opteameo/data/teams/logos ~/Sites/opteameo/afp-web-foot/dist/data/teams/
rsync -r -a -v -e ssh root@91.134.141.206:/mnt/vdb/opteameo/data/players ~/Sites/opteameo/afp-web-foot/dist/data/
rsync -r -a -v -e ssh root@91.134.141.206:/mnt/vdb/opteameo/data/events ~/Sites/opteameo/afp-web-foot/dist/data/
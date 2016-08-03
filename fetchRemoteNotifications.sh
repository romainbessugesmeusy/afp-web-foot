#!/bin/sh
rsync -r -a -v -e ssh root@91.134.141.206:/mnt/vdb/opteameo/data/notifications ~/Sites/opteameo/afp-web-foot/dist/data/

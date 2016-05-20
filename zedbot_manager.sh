#!/bin/bash

# This generates a file every 5 minutes

while true; do
	su -c "node /home/zedbot/zedbot-scraper/zedbot_manager.js >>/home/zedbot/data/logs/zedbot_manager.log 2>&1"  zedbot
	sleep 30
done


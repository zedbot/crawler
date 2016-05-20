#!/bin/bash

# This generates a file every 5 minutes
site=$1
type=$2
version=$3
batch=$4
mode=$5

PID=`ps -eo pid,lstart,cmd | grep node |grep $site |grep $type | tail -1 | awk  '{print $1}'`
DATE=`ps -eo pid,lstart,cmd | grep node |grep $site |grep $type | tail -1 | awk '{print $2, $3,$4,$5,$6}'`
if [ -z "$PID" -a $mode == "start" ];then
	echo `date` node /home/zedbot/zedbot-scraper/zedbot.js $site $type $version $batch >>/home/zedbot/data/logs/scraper/$type-$site-cmd.log
	node /home/zedbot/zedbot-scraper/zedbot.js $site $type $version $batch >>/home/zedbot/data/logs/scraper/$type-$site.log 2>&1
	echo `date` node /home/zedbot/zedbot-scraper/export.js $site $type $version $batch  $6 $7 $8>>/home/zedbot/data/logs/scraper/$type-$site-cmd.log
	node /home/zedbot/zedbot-scraper/export.js $site $type $version $batch $6 $7 $8 >>/home/zedbot/data/logs/scraper/$type-$site-export.log 2>&1
  echo all done 
else
    echo "process is runnning";
fi;

if [[ $(date -d "$DATE" +%s) < $(date  --date="2 days ago" +%s) ]]; then
  echo "process is processing to looooong....killing it";
	kill $PID
fi;

if [ $? -eq 0 -a $mode == "stop" ];then
	echo killing $PID
	kill $PID
fi;


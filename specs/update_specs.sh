FILE="$1.json"

if [ -e "$FILE" ]
then
curl -XPOST "http://localhost:9200/zedbot_site/$1/_default" -d @$FILE
else
echo Unable to open $FILE
fi

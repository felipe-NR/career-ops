if [ ! -d "dashboard" ]; then
  echo "Dashboard directory not found. Please make sure you are in the correct directory."
  exit 1
fi
cd dashboard && go build -o career-dashboard . && ./career-dashboard --path ..

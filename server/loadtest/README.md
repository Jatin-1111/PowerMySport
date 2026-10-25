# Booking load test (throwaway Mongo only)

`env.ts` pins every entry point to a local replica-set Mongo and refuses anything else.
Run from a directory with no `.env` so dotenv cannot load production values.

    docker run -d --name pms-loadtest-mongo -p 127.0.0.1:27117:27017 --memory 2g mongo:7 --replSet rs0 --bind_ip_all
    docker exec pms-loadtest-mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'

    # from any dir without a .env:
    node server/node_modules/ts-node/dist/bin.js --transpile-only --project server/tsconfig.json server/loadtest/seed.ts
    ... history.ts            # 2M past bookings (about 20 min)
    ... run.ts [hot|overlap|ramp|hotvenues|collateral|funnel|all]   # KEEP=1 keeps existing bookings

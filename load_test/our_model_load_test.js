import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const successRate = new Rate('success');
const apiDuration = new Trend('api_duration');
const requestCount = new Counter('request_count');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users over 30s
    { duration: '1m', target: 25 },   // Ramp up to 25 users over 1m
    { duration: '1m', target: 50 },   // Ramp up to 50 users over 1m
    { duration: '2m', target: 50 },   // Stay at 50 users for 2m
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    errors: ['rate<0.1'],             // Error rate should be less than 10%
  },
};

const API_URL = 'https://dummyjson.com/test';

export default function () {
  const payload = JSON.stringify({
    message: 'hello',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s',
  };

  const startTime = new Date();
  const response = http.post(API_URL, payload, params);
  const duration = new Date() - startTime;

  apiDuration.add(duration);
  requestCount.add(1);

  const result = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has valid response': (r) => r.body && r.body.length > 0,
  });

  if (result) {
    successRate.add(1);
    errorRate.add(0);
  } else {
    successRate.add(0);
    errorRate.add(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  console.log('\n=== LOAD TEST SUMMARY ===\n');
  
  console.log('Test Duration:', data.metrics.iteration_duration.values.avg.toFixed(2), 'ms (avg)');
  console.log('Total Requests:', data.metrics.http_reqs.values.count);
  console.log('Request Rate:', data.metrics.http_reqs.values.rate.toFixed(2), 'req/s');
  
  console.log('\n--- Response Times ---');
  console.log('Min:', data.metrics.http_req_duration.values.min.toFixed(2), 'ms');
  console.log('Avg:', data.metrics.http_req_duration.values.avg.toFixed(2), 'ms');
  console.log('Max:', data.metrics.http_req_duration.values.max.toFixed(2), 'ms');
  console.log('P95:', data.metrics.http_req_duration.values['p(95)'].toFixed(2), 'ms');
  console.log('P99:', data.metrics.http_req_duration.values['p(99)'].toFixed(2), 'ms');
  
  console.log('\n--- Success Metrics ---');
  console.log('Success Rate:', (data.metrics.success?.values.rate * 100 || 0).toFixed(2), '%');
  console.log('Error Rate:', (data.metrics.errors?.values.rate * 100 || 0).toFixed(2), '%');
  
  console.log('\n--- HTTP Status Codes ---');
  if (data.metrics.http_req_failed) {
    console.log('Failed Requests:', (data.metrics.http_req_failed.values.rate * 100).toFixed(2), '%');
  }
  
  console.log('\n========================\n');
  
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}

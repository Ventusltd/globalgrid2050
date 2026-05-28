# V5 multi year loading patch

Implemented 2 year, 5 year and 10 year price history windows. Added a deliberately paced loader for 12 month, 2 year, 5 year and 10 year windows so Safari has breathing time while annual files load. Added draw decimation to reduce canvas overload while preserving true HIGH and LOW event detection from the full filtered row set. Simplified x axis labelling to full start date and full end date only, preventing bottom label clashes. Updated cache keys to 20260527o.

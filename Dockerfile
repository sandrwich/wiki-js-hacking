FROM requarks/wiki:2
COPY plugin/html-data-gremlin /wiki/server/modules/rendering/html-data-gremlin
COPY plugin/ext-data-gremlin /wiki/server/modules/extensions/data-gremlin
COPY plugin/analytics-table-tidy /wiki/server/modules/analytics/table-tidy
COPY plugin/html-footnotes /wiki/server/modules/rendering/html-footnotes
COPY plugin/analytics-footnote-btn /wiki/server/modules/analytics/footnote-btn

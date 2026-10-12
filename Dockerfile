FROM php:8.2-apache

# 1. Install Node.js, SQLite, na zana za msingi
RUN apt-get update && apt-get install -y \
    curl \
    sqlite3 \
    libsqlite3-dev \
    && curl -sL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && docker-php-ext-install pdo pdo_sqlite

# 2. Redirection kwa ajili ya Dashboard/Landing Page
RUN echo '<?php header("Location: index.php"); exit(); ?>' > /var/www/html/index.php

# 3. Copy mafaili yako yote
COPY . /var/www/html/

# 4. Weka permission sahihi kwa Apache (www-data)
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

WORKDIR /var/www/html

# 5. Install Node dependencies
RUN if [ -f package.json ]; then npm install; fi

# 6. Badilisha Port ya Apache kwenda 7860
RUN sed -i 's/80/7860/g' /etc/apache2/ports.conf /etc/apache2/sites-available/000-default.conf

EXPOSE 7860

# 7. Anzisha Node.js ya Binance, Coinbase Runner background, na Apache Server
CMD sh -c "if [ -f index.js ]; then PORT=3000 node index.js & fi; if [ -f coinbase_runner.js ]; then node coinbase_runner.js & fi; if [ -f okx_runner.js ]; then node okx_runner.js & fi; apache2-foreground"

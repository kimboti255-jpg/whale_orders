FROM php:8.2-apache

# 1. Sasisha mfumo na usakinishe Node.js, SQLite, na zana zinazohitajika
RUN apt-get update && apt-get install -y \
    curl \
    sqlite3 \
    libsqlite3-dev \
    && curl -sL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && docker-php-ext-install pdo pdo_sqlite

# 2. Weka saraka ya kazi kwenye folda ya Apache
WORKDIR /var/www/html

# 3. Nakili mafaili yote ya mradi wako ndani ya kontena
COPY . /var/www/html/

# 4. Weka ruhusa (permissions) sahihi kwa ajili ya Apache na hifadhi ya SQLite
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# 5. Sakinisha vifurushi vya Node.js (kama package.json ipo)
RUN if [ -f package.json ]; then npm install; fi

# 6. Badilisha Port ya Apache kwenda 7860 ili iendane na mifumo ya wingu
RUN sed -i 's/80/7860/g' /etc/apache2/ports.conf /etc/apache2/sites-available/000-default.conf

EXPOSE 7860

# 7. Amri ya kuachia Node.js (index.js) ianze kukimbia nyuma ya pazia, kisha Apache iwake
CMD sh -c "node index.js & apache2-foreground"

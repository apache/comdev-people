FROM ubuntu:24.04

RUN apt-get update \
    && apt-get --assume-yes install software-properties-common curl wget

RUN apt-get --assume-yes install \
    lua5.2 \
    liblua5.2-dev \
    lua5.2-cjson \
    lua5.2-socket \
    lua5.2-sec \
    python3-pip

RUN pip3 install ezt --break-system-packages

RUN apt-get install --assume-yes apache2

RUN echo "ServerName home.local" > /etc/apache2/conf-enabled/servername.conf

WORKDIR /var/www

CMD apache2ctl -DFOREGROUND
